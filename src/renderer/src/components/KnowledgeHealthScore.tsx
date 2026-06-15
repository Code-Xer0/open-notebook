import React, { useState } from 'react';
import { Activity, Info } from 'lucide-react';
import { CollapsiblePane } from './CollapsiblePane';

export function KnowledgeHealthScore() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <CollapsiblePane title="Knowledge Health" icon={<Activity size={16} />} defaultExpanded={true}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative' }}>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          title="What is Knowledge Health?"
        >
          <Info size={14} />
        </button>

        <div style={{ 
          width: '120px', height: '120px', borderRadius: '50%', 
          border: '4px solid var(--border-color)', 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'none'
        }}>
          <span style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)' }}>?</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>UNKNOWN</span>
        </div>

        {showDetails && (
          <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'var(--panel-bg)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-muted)' }}>What is Knowledge Health?</h4>
            <p style={{ margin: '0 0 8px 0' }}>This score represents the reliability and cohesiveness of your knowledge base.</p>
            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-muted)' }}>
              <li><strong>Improves by:</strong> High citation coverage, resolved entities, successful ingestions.</li>
              <li><strong>Degrades by:</strong> Orphan content, broken citations, conflicting timelines, failed sources.</li>
            </ul>
          </div>
        )}
      </div>
    </CollapsiblePane>
  );
}
