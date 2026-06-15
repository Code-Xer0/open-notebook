import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CollapsiblePane } from './CollapsiblePane';

export function KnowledgeAlerts() {
  // TODO: Map to useStore when backend alerts are available
  const alerts: any[] = [];

  return (
    <CollapsiblePane title="Knowledge Alerts" icon={<AlertTriangle size={16} />} defaultExpanded={true}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alerts.length > 0 ? alerts.map((alert, i) => {
          const isError = alert.type === 'error';
          const colorVar = isError ? 'var(--signal-error)' : 'var(--signal-warning)';
          const bgVar = isError ? 'rgba(255, 85, 119, 0.05)' : 'rgba(245, 194, 107, 0.05)';
          
          return (
            <div key={i} style={{ padding: '12px', borderLeft: `2px solid ${colorVar}`, background: bgVar }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: colorVar, fontWeight: 600 }}>{alert.label}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{alert.time}</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-main)', margin: 0 }}>{alert.msg}</p>
            </div>
          );
        }) : (
          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>
            No active alerts.
          </div>
        )}
      </div>
    </CollapsiblePane>
  );
}
