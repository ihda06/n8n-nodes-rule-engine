import { set } from 'lodash';

import {
	ApplicationError,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { ENABLE_LESS_STRICT_TYPE_VALIDATION } from './utils';

import * as executor from './executor';
import { INCLUDE, IncludeMods, SetNodeOptions } from './helpers/interfaces';
import { getTypeValidationParameter, getTypeValidationStrictness } from './utils';
export class RuleEngine implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			displayName: 'Rule Engine',
			name: 'ruleEngine',
			icon: 'fa:map-signs',
			iconColor: 'green',
			group: ['transform'],
			description: 'Grouping rule',
			version: 1,
			defaults: {
				name: 'Rule Engine',
				color: '#408000',
			},
			inputs: ['main'],
			outputs: ['main'],
			outputNames: ['true'],
			parameterPane: 'wide',
			properties: [
				{
					displayName: 'Conditions',
					name: 'conditions',
					placeholder: 'Add Condition',
					type: 'filter',
					default: {},
					typeOptions: {
						filter: {
							caseSensitive: '={{!$parameter.options.ignoreCase}}',
							typeValidation: getTypeValidationStrictness(2.1),
							// version: '={{ $nodeVersion >= 2.2 ? 2 : 1 }}',
						},
					},
				},
				{
					displayName: 'Result to Set',
					name: 'assignments',
					type: 'assignmentCollection',
					default: {},
				},
				{
					displayName: 'Include Other Input Fields',
					name: 'includeOtherFields',
					type: 'boolean',
					default: false,
					description:
						"Whether to pass to the output all the input fields (along with the fields set in 'Fields to Set')",
				},
				{
					displayName: 'Input Fields to Include',
					name: 'include',
					type: 'options',
					description: 'How to select the fields you want to include in your output items',
					default: 'all',
					displayOptions: {
						hide: {
							'/includeOtherFields': [false],
						},
					},
					options: [
						{
							name: 'All',
							value: INCLUDE.ALL,
							description: 'Also include all unchanged fields from the input',
						},
						{
							name: 'Selected',
							value: INCLUDE.SELECTED,
							description: 'Also include the fields listed in the parameter “Fields to Include”',
						},
						{
							name: 'All Except',
							value: INCLUDE.EXCEPT,
							description: 'Exclude the fields listed in the parameter “Fields to Exclude”',
						},
					],
				},
				{
					displayName: 'Fields to Include',
					name: 'includeFields',
					type: 'string',
					default: '',
					placeholder: 'e.g. fieldToInclude1,fieldToInclude2',
					description:
						'Comma-separated list of the field names you want to include in the output. You can drag the selected fields from the input panel.',
					requiresDataPath: 'multiple',
					displayOptions: {
						show: {
							include: ['selected'],
						},
					},
				},
				{
					displayName: 'Fields to Exclude',
					name: 'excludeFields',
					type: 'string',
					default: '',
					placeholder: 'e.g. fieldToExclude1,fieldToExclude2',
					description:
						'Comma-separated list of the field names you want to exclude from the output. You can drag the selected fields from the input panel.',
					requiresDataPath: 'multiple',
					displayOptions: {
						show: {
							include: ['except'],
						},
					},
				},
			],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const trueItems: INodeExecutionData[] = [];

		// Logger.info(`RuleEngine.execute: ${this.getInputData(0, 'conditions').length}`);
		this.logger.info(`inputs ${this.getInputData().toString()}`);
		this.logger.info(`conditions input: ${this.getInputData(0, 'conditions').length}`);
		// const minCondition = this.getInputData(0, 'conditions').length;
		this.getInputData(0, 'conditions').forEach((item, itemIndex) => {
			try {
				const options = this.getNodeParameter('options', itemIndex) as {
					ignoreCase?: boolean;
					looseTypeValidation?: boolean;
				};
				let pass = false;
				try {
					pass = this.getNodeParameter('conditions', itemIndex, false, {
						extractValue: true,
					}) as boolean;
				} catch (error) {
					if (
						!getTypeValidationParameter(2.1)(this, itemIndex, options.looseTypeValidation) &&
						!error.description
					) {
						set(error, 'description', ENABLE_LESS_STRICT_TYPE_VALIDATION);
					}
					set(error, 'context.itemIndex', itemIndex);
					set(error, 'node', this.getNode());
					throw error;
				}

				if (item.pairedItem === undefined) {
					item.pairedItem = { item: itemIndex };
				}

				if (pass) {
					trueItems.push(item);
				}
			} catch (error) {
				this.logger.warn(`RuleEngine.execute: error: ${error}`);
				if (this.continueOnFail()) {
				} else {
					if (error instanceof NodeOperationError) {
						throw error;
					}

					if (error instanceof ApplicationError) {
						set(error, 'context.itemIndex', itemIndex);
						throw error;
					}

					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		});

		const results = this.getInputData(1, 'assignments');

		this.logger.info(`results input :: ${results.length}`);
		const returnData: INodeExecutionData[] = [];
		for (let i = 0; i < results.length; i++) {
			const includeOtherFields = this.getNodeParameter('includeOtherFields', i, false) as boolean;
			const include = this.getNodeParameter('include', i, 'all') as IncludeMods;
			const options = this.getNodeParameter('options', i, {});
			const node = this.getNode();

			options.include = includeOtherFields ? include : 'none';

			const newItem = await executor.execute.call(
				this,
				results[i],
				i,
				options as SetNodeOptions,
				node,
			);

			returnData.push(newItem);
		}

		return [returnData, trueItems];
	}
}
