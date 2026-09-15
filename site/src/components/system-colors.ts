/** System-color names and uses shared by the live samples and Markdown. */
export const SYSTEM_COLORS = [
  { colors: ['Canvas', 'CanvasText'], use: 'Document background and text', background: 'Canvas', foreground: 'CanvasText', label: 'Document text' },
  { colors: ['ButtonFace', 'ButtonText', 'ButtonBorder'], use: 'Control surface, text, and edge', background: 'ButtonFace', foreground: 'ButtonText', border: 'ButtonBorder', label: 'Control label' },
  { colors: ['Field', 'FieldText'], use: 'Input field background and text', background: 'Field', foreground: 'FieldText', label: 'Field value' },
  { colors: ['Highlight', 'HighlightText'], use: 'Selected text', background: 'Highlight', foreground: 'HighlightText', label: 'Selected text' },
  { colors: ['SelectedItem', 'SelectedItemText'], use: 'Selected control or list item', background: 'SelectedItem', foreground: 'SelectedItemText', label: 'Selected item' },
  { colors: ['Mark', 'MarkText'], use: 'Marked text, such as <mark>', background: 'Mark', foreground: 'MarkText', label: 'Marked text' },
  { colors: ['AccentColor', 'AccentColorText'], use: 'Accented control', background: 'AccentColor', foreground: 'AccentColorText', label: 'Accent control' },
  { colors: ['LinkText'], use: 'Unvisited link text', background: 'Canvas', foreground: 'LinkText', label: 'Unvisited link' },
  { colors: ['VisitedText'], use: 'Visited link text', background: 'Canvas', foreground: 'VisitedText', label: 'Visited link' },
  { colors: ['ActiveText'], use: 'Active link text', background: 'Canvas', foreground: 'ActiveText', label: 'Active link' },
  { colors: ['GrayText'], use: 'Disabled text', background: 'Canvas', foreground: 'GrayText', label: 'Disabled text' },
] as const
