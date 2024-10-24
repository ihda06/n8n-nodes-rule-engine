
import {set} from "lodash"

import {
	ApplicationError,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription
} from 'n8n-workflow';
import { ENABLE_LESS_STRICT_TYPE_VALIDATION } from './utils';
// import { looseTypeValidationProperty } from './utils';
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
			inputs: ["main"],
			outputs: ["main"],
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
			],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const trueItems: INodeExecutionData[] = [];
		const falseItems: INodeExecutionData[] = [];

		this.getInputData().forEach((item, itemIndex) => {
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
				} else {
					falseItems.push(item);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					falseItems.push(item);
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

		return [trueItems, falseItems];
	}
}