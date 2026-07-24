export const SCHEMA_VERSION = 2;

export function validateSynthesis(obj) {
  const errors = [];

  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["root value must be an object"] };
  }

  if (obj.schemaVersion === undefined) {
    errors.push(`schemaVersion is required (expected ${SCHEMA_VERSION}, got none)`);
  } else if (obj.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}, got ${JSON.stringify(obj.schemaVersion)}`);
  }

  if (typeof obj.generatedAt !== "string" || Number.isNaN(Date.parse(obj.generatedAt))) {
    errors.push("generatedAt must be a parseable ISO-8601 string");
  }
  if (typeof obj.query !== "string" || obj.query.length === 0) {
    errors.push("query must be a non-empty string");
  }
  if (typeof obj.headline !== "string" || obj.headline.length === 0) {
    errors.push("headline must be a non-empty string");
  }
  if (typeof obj.consensus !== "string" || obj.consensus.length === 0) {
    errors.push("consensus must be a non-empty string");
  }

  const sourceListValid = Array.isArray(obj.sourceList);
  if (!sourceListValid) {
    errors.push("sourceList must be an array");
  }
  const knownSources = new Set((sourceListValid ? obj.sourceList : []).map(s => s && s.name));

  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    errors.push("sections must be a non-empty array");
  } else {
    obj.sections.forEach((section, i) => {
      if (typeof section !== "object" || section === null) {
        errors.push(`sections[${i}] must be an object`);
        return;
      }
      if (typeof section.subheading !== "string" || section.subheading.length === 0) {
        errors.push(`sections[${i}].subheading must be a non-empty string`);
      }
      if (section.framingLabel !== undefined && section.framingLabel !== null && typeof section.framingLabel !== "string") {
        errors.push(`sections[${i}].framingLabel must be a string or null`);
      }
      if (!Array.isArray(section.sentences) || section.sentences.length === 0) {
        errors.push(`sections[${i}].sentences must be a non-empty array`);
      } else {
        section.sentences.forEach((sentence, j) => {
          if (typeof sentence !== "object" || sentence === null) {
            errors.push(`sections[${i}].sentences[${j}] must be an object`);
            return;
          }
          if (typeof sentence.text !== "string" || sentence.text.length === 0) {
            errors.push(`sections[${i}].sentences[${j}].text must be a non-empty string`);
          }
          if (!Array.isArray(sentence.sources) || sentence.sources.length === 0) {
            errors.push(`sections[${i}].sentences[${j}].sources must be a non-empty array`);
          } else {
            sentence.sources.forEach(s => {
              if (!knownSources.has(s)) errors.push(`sections[${i}].sentences[${j}].sources references unknown source "${s}"`);
            });
          }
          if (typeof sentence.disputed !== "boolean") {
            errors.push(`sections[${i}].sentences[${j}].disputed must be a boolean, got ${JSON.stringify(sentence.disputed)}`);
          }
        });
      }
    });
  }

  if (!Array.isArray(obj.disagreementGroups)) {
    errors.push("disagreementGroups must be an array");
  } else {
    obj.disagreementGroups.forEach((group, i) => {
      if (typeof group !== "object" || group === null) {
        errors.push(`disagreementGroups[${i}] must be an object`);
        return;
      }
      if (typeof group.stance !== "string" || group.stance.length === 0) {
        errors.push(`disagreementGroups[${i}].stance must be a non-empty string`);
      }
      if (!Array.isArray(group.sources) || group.sources.length === 0) {
        errors.push(`disagreementGroups[${i}].sources must be a non-empty array`);
      } else {
        group.sources.forEach(s => {
          if (!knownSources.has(s)) errors.push(`disagreementGroups[${i}].sources references unknown source "${s}"`);
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
