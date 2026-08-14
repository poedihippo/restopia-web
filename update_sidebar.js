const fs = require('fs');
let content = fs.readFileSync('c:\\dapur-cokelat-web\\src\\components\\app-sidebar.tsx', 'utf8');

// Export types
content = content.replace(/type NavChild/g, 'export type NavChild');
content = content.replace(/type NavItem/g, 'export type NavItem');
content = content.replace(/type NavGroup/g, 'export type NavGroup');
content = content.replace(/const NAV_GROUPS/g, 'export const NAV_GROUPS');

// Replace permissions within NAV_GROUPS definition
const match = content.match(/export const NAV_GROUPS: NavGroup\[\] = \[([\s\S]*?)\];/);
if (match) {
  let groupsStr = match[1];
  groupsStr = groupsStr.replace(/permission:\s*'([^']+)\.(read|create)'/g, (m, p1) => {
    return `permission: '${p1}.menu'`;
  });
  content = content.replace(match[1], groupsStr);
}

fs.writeFileSync('c:\\dapur-cokelat-web\\src\\components\\app-sidebar.tsx', content);
console.log('Sidebar permissions updated.');
