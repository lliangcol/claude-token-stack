const fs = require("fs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function typeMatches(expected, value) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === expected;
}

function validate(schema, value, location = "$") {
  const errors = [];
  if (schema.oneOf) {
    const matches = schema.oneOf
      .map((candidate) => validate(candidate, value, location))
      .filter((candidateErrors) => candidateErrors.length === 0);
    return matches.length === 1 ? [] : [`${location} must match exactly one schema`];
  }
  if (schema.type && !typeMatches(schema.type, value)) {
    return [`${location} must be ${schema.type}`];
  }
  if (Object.prototype.hasOwnProperty.call(schema, "const") && value !== schema.const) {
    errors.push(`${location} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${location} must be one of ${schema.enum.join(", ")}`);
  }
  if (schema.type === "string" && schema.minLength && value.length < schema.minLength) {
    errors.push(`${location} must not be empty`);
  }
  if ((schema.type === "number" || schema.type === "integer") && Object.prototype.hasOwnProperty.call(schema, "minimum") && value < schema.minimum) {
    errors.push(`${location} must be >= ${schema.minimum}`);
  }
  if (schema.type === "array") {
    if (schema.minItems && value.length < schema.minItems) {
      errors.push(`${location} must have at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validate(schema.items, item, `${location}[${index}]`));
      });
    }
  }
  if (schema.type === "object") {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${location}.${key} is required`);
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...validate(childSchema, value[key], `${location}.${key}`));
      }
    }
  }
  return errors;
}

module.exports = {
  readJson,
  validate,
};
