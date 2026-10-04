export function decodeFilename(name) {
  if (!name) return name;
  return name.replace(/#U([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

export const EXT_ICON = {
  '.hwp': '📝', '.hwpx': '📝', '.docx': '📄',
  '.xlsx': '📊', '.pdf': '📕', '.txt': '📃', '.csv': '📋',
};

export function getExtIcon(filename) {
  const ext = '.' + (filename || '').split('.').pop().toLowerCase();
  return EXT_ICON[ext] || '📄';
}
