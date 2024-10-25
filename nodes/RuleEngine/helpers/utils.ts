import type {
	FieldType,
	IDataObject,
	IDisplayOptions,
	IExecuteFunctions,
	INode,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import {
	ApplicationError,
	NodeOperationError,
	deepCopy,
	getValueDescription,
	validateFieldType,
} from 'n8n-workflow';
import { INCLUDE, SetNodeOptions } from './interfaces';

import { merge } from 'lodash';
import get from 'lodash/get';
import set from 'lodash/set';
import unset from 'lodash/unset';

export const validateEntry = (
	name: string,
	type: FieldType,
	value: unknown,
	node: INode,
	itemIndex: number,
	ignoreErrors = false,
) => {
	if (value === undefined || value === null) {
		return { name, value: null };
	}

	const description = `To fix the error try to change the type for the field "${name}" or activate the option “Ignore Type Conversion Errors” to apply a less strict type validation`;

	if (type === 'string') {
		if (value === undefined || value === null) {
			if (ignoreErrors) {
				return { name, value: null };
			} else {
				throw new NodeOperationError(
					node,
					`'${name}' expects a ${type} but we got ${getValueDescription(value)} [item ${itemIndex}]`,
					{ description },
				);
			}
		} else if (typeof value === 'object') {
			value = JSON.stringify(value);
		} else {
			value = String(value);
		}
	}

	const validationResult = validateFieldType(name, value, type);

	if (!validationResult.valid) {
		if (ignoreErrors) {
			return { name, value: value ?? null };
		} else {
			const message = `${validationResult.errorMessage} [item ${itemIndex}]`;
			throw new NodeOperationError(node, message, {
				itemIndex,
				description,
			});
		}
	}

	return {
		name,
		value: validationResult.newValue ?? null,
	};
};

export function composeReturnItem(
	this: IExecuteFunctions,
	itemIndex: number,
	inputItem: INodeExecutionData,
	newFields: IDataObject,
	options: SetNodeOptions,
) {
	const newItem: INodeExecutionData = {
		json: {},
		pairedItem: { item: itemIndex },
	};

	const fieldHelper = configureFieldHelper(options.dotNotation);

	switch (options.include) {
		case INCLUDE.ALL:
			newItem.json = deepCopy(inputItem.json);
			break;
		case INCLUDE.SELECTED:
			const includeFields = (this.getNodeParameter('includeFields', itemIndex) as string)
				.split(',')
				.map((item) => item.trim())
				.filter((item) => item);

			for (const key of includeFields) {
				const fieldValue = fieldHelper.get(inputItem.json, key) as IDataObject;
				let keyToSet = key;
				if (options.dotNotation !== false && key.includes('.')) {
					keyToSet = key.split('.').pop() as string;
				}
				fieldHelper.set(newItem.json, keyToSet, fieldValue);
			}
			break;
		case INCLUDE.EXCEPT:
			const excludeFields = (this.getNodeParameter('excludeFields', itemIndex) as string)
				.split(',')
				.map((item) => item.trim())
				.filter((item) => item);

			const inputData = deepCopy(inputItem.json);

			for (const key of excludeFields) {
				fieldHelper.unset(inputData, key);
			}

			newItem.json = inputData;
			break;
		case INCLUDE.NONE:
			break;
		default:
			throw new ApplicationError(`The option "${options.include}" is not supported.`, {
				level: 'warning',
				tags: {},
				extra: {},
			});
	}

	for (const key of Object.keys(newFields)) {
		fieldHelper.set(newItem.json, key, newFields[key] as IDataObject);
	}

	return newItem;
}

const configureFieldHelper = (dotNotation?: boolean) => {
	if (dotNotation !== false) {
		return {
			set: (item: IDataObject, key: string, value: IDataObject) => {
				set(item, key, value);
			},
			get: (item: IDataObject, key: string) => {
				return get(item, key);
			},
			unset: (item: IDataObject, key: string) => {
				unset(item, key);
			},
		};
	} else {
		return {
			set: (item: IDataObject, key: string, value: IDataObject) => {
				item[sanitizeDataPathKey(item, key)] = value;
			},
			get: (item: IDataObject, key: string) => {
				return item[sanitizeDataPathKey(item, key)];
			},
			unset: (item: IDataObject, key: string) => {
				delete item[sanitizeDataPathKey(item, key)];
			},
		};
	}
};

export const sanitizeDataPathKey = (item: IDataObject, key: string) => {
	if (item[key] !== undefined) {
		return key;
	}

	if (
		(key.startsWith("['") && key.endsWith("']")) ||
		(key.startsWith('["') && key.endsWith('"]'))
	) {
		key = key.slice(2, -2);
		if (item[key] !== undefined) {
			return key;
		}
	}
	return key;
};

export function updateDisplayOptions(
	displayOptions: IDisplayOptions,
	properties: INodeProperties[],
) {
	return properties.map((nodeProperty) => {
		return {
			...nodeProperty,
			displayOptions: merge({}, nodeProperty.displayOptions, displayOptions),
		};
	});
}

export function compareJsonFieldsStrict(json1: any, json2: any): void {
	const keys1 = Object.keys(json1);
	const keys2 = Object.keys(json2);

	// Check if the two JSON objects have the same number of keys
	if (keys1.length !== keys2.length) {
		throw new ApplicationError('JSON objects do not have the same number of keys.');
	}

	// Check if all keys exist in both objects
	keys1.forEach((key) => {
		if (!json2.hasOwnProperty(key)) {
			throw new ApplicationError(`Key '${key}' exists in JSON1 but not in JSON2.`);
		}

		// Check data types for matching keys
		const type1 = typeof json1[key];
		const type2 = typeof json2[key];

		if (type1 !== type2) {
			throw new ApplicationError(
				`Key '${key}' exists in both JSONs but types differ. JSON1: ${type1}, JSON2: ${type2}`,
			);
		}
	});

	// Check if all keys in JSON2 also exist in JSON1 (this step is redundant if we already checked both directions)
	keys2.forEach((key) => {
		if (!json1.hasOwnProperty(key)) {
			throw new ApplicationError(`Key '${key}' exists in JSON2 but not in JSON1.`);
		}
	});
}
