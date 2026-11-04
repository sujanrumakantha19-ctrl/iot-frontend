export const GATEWAY_PROTOCOLS = [
  { value: 'all', label: 'ALL' },
  { value: 'rtu', label: 'Modbus RTU' },
  { value: 'tcp', label: 'Modbus TCP' },
]

export function gatewayWorkspaces(protocol = 'all') {
  return [
    { id: 'rtu', label: 'Modbus RTU', icon: 'pi pi-server' },
    { id: 'tcp', label: 'Modbus TCP', icon: 'pi pi-sitemap' },
    { id: 'settings', label: 'Settings', icon: 'pi pi-cog' },
  ].filter(workspace => workspace.id === 'settings' || !['rtu', 'tcp'].includes(protocol) || workspace.id === protocol)
}

export function allowedGatewayWorkspace(selected, protocol) {
  const workspaces = gatewayWorkspaces(protocol)
  return workspaces.some(workspace => workspace.id === selected) ? selected : workspaces[0].id
}
