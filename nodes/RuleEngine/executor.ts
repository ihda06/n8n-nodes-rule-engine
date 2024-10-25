import {
	AssignmentCollectionValue,
	FieldType,
	IExecuteFunctions,
	INode,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import { SetNodeOptions } from './helpers/interfaces';
import { composeReturnItem, validateEntry } from './helpers/utils';

export async function execute(
	this: IExecuteFunctions,
	item: INodeExecutionData,
	i: number,
	options: SetNodeOptions,
	node: INode,
) {
	try {
		const assignmentCollection = this.getNodeParameter(
			'assignments',
			i,
		) as AssignmentCollectionValue;

		const newData = Object.fromEntries(
			(assignmentCollection?.assignments ?? []).map((assignment) => {
				const { name, value } = validateEntry(
					assignment.name,
					assignment.type as FieldType,
					assignment.value,
					node,
					i,
					options.ignoreConversionErrors,
				);

				return [name, value];
			}),
		);
		return composeReturnItem.call(this, i, item, newData, options);
	} catch (error) {
		if (this.continueOnFail()) {
			return { json: { error: (error as Error).message, pairedItem: { item: i } } };
		}
		throw new NodeOperationError(this.getNode(), error as Error, {
			itemIndex: i,
			description: error.description,
		});
	}
}
