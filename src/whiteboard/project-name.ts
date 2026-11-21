export function defaultProjectName(date = new Date()) {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return `sketchify_${day}`;
}

export function projectNameLabel(name: string) {
  return /^sketchify_\d{4}-\d{2}-\d{2}$/.test(name) ? 'Sketchify' : name;
}

export function renamedProject(value: string, previous: string) {
  const name = value.trim();
  return !name || name === projectNameLabel(previous) ? previous : name;
}
