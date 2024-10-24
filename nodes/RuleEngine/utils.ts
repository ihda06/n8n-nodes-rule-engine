import type { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

export const getTypeValidationStrictness = (version: number) => {
	return `={{ ($nodeVersion < ${version} ? $parameter.options.looseTypeValidation :  $parameter.looseTypeValidation) ? "loose" : "strict" }}`;
};

export const getTypeValidationParameter = (version: number) => {
	return (context: IExecuteFunctions, itemIndex: number, option: boolean | undefined) => {
		if (context.getNode().typeVersion < version) {
			return option;
		} else {
			return context.getNodeParameter('looseTypeValidation', itemIndex, false) as boolean;
		}
	};
};

export const looseTypeValidationProperty: INodeProperties = {
	// eslint-disable-next-line
	displayName: 'Convert types where required',
	// eslint-disable-next-line
	description:
		'If the type of an expression doesn\'t match the type of the comparison, n8n will try to cast the expression to the required type. E.g. for booleans <code>"false"</code> or <code>0</code> will be cast to <code>false</code>',
	name: 'looseTypeValidation',
	type: 'boolean',
	default: true,
};

export const ENABLE_LESS_STRICT_TYPE_VALIDATION =
	"Try changing the type of comparison. Alternatively you can enable 'Convert types where required'.";