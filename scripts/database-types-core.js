function normalizeDatabaseTypes(text) {
  return text.replace(/\r\n/g, "\n").trimEnd() + "\n";
}

function compareDatabaseTypes(currentText, generatedText) {
  const current = normalizeDatabaseTypes(currentText);
  const generated = normalizeDatabaseTypes(generatedText);
  return {
    current,
    generated,
    matches: current === generated
  };
}

module.exports = {
  compareDatabaseTypes,
  normalizeDatabaseTypes
};
