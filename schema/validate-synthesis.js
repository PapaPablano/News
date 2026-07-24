const STANCES = new Set(["corroborating", "dissenting"]);

export function validateSynthesis(obj) {
  const errors = [];

  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["root value must be an object"] };
  }

  if (typeof obj.generatedAt !== "string" || Number.isNaN(Date.parse(obj.generatedAt))) {
    errors.push("generatedAt must be a parseable ISO-8601 string");
  }
  if (typeof obj.query !== "string" || obj.query.length === 0) {
    errors.push("query must be a non-empty string");
  }
  if (typeof obj.consensus !== "string" || obj.consensus.length === 0) {
    errors.push("consensus must be a non-empty string");
  }

  const sourceListValid = Array.isArray(obj.sourceList);
  if (!sourceListValid) {
    errors.push("sourceList must be an array");
  }
  const knownSources = new Set((sourceListValid ? obj.sourceList : []).map(s => s && s.name));

  if (!Array.isArray(obj.narrative) || obj.narrative.length === 0) {
    errors.push("narrative must be a non-empty array");
  } else {
    obj.narrative.forEach((entry, i) => {
      if (typeof entry.text !== "string" || entry.text.length === 0) {
        errors.push(`narrative[${i}].text must be a non-empty string`);
      }
      if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
        errors.push(`narrative[${i}].sources must be a non-empty array`);
      } else {
        entry.sources.forEach(s => {
          if (!knownSources.has(s)) errors.push(`narrative[${i}].sources references unknown source "${s}"`);
        });
      }
      if (!STANCES.has(entry.stance)) {
        errors.push(`narrative[${i}].stance must be "corroborating" or "dissenting", got ${JSON.stringify(entry.stance)}`);
      }
    });
  }

  if (!Array.isArray(obj.disagreementGroups)) {
    errors.push("disagreementGroups must be an array");
  } else {
    obj.disagreementGroups.forEach((group, i) => {
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
