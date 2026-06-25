import React, { useState, useEffect } from 'react';
import { Send, Bot, User, Sparkles, MoreVertical, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useParams } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const { id: notebookId } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Ask a question about this notebook. Answers should be checked against cited source passages.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Optionally create or load a session when Chat mounts
    if (notebookId) {
      // In a real implementation you might fetch the session for this notebook
    }
  }, [notebookId]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Use standard execution if we don't have a specific session
      const response = await api.chat.execute({
        message: userMessage,
        notebook_id: notebookId,
        session_id: sessionId
      });
      
      if (response.session_id) {
        setSessionId(response.session_id);
      }
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: response.response || response.content || 'Error: Empty response from AI' 
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: `Error: ${error.message || 'Failed to connect to AI backend'}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden' }}>
      {/* Chat Header */}
      <div style={{ 
        padding: '1.25rem', 
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--panel-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            background: 'var(--color-primary)', 
            padding: '0.5rem', 
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={16} color="var(--shell-bg)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Notebook Chat</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{notebookId ? 'Grounded to selected notebook' : 'No notebook selected'}</span>
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ 
            display: 'flex', 
            gap: '1rem',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
          }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: msg.role === 'user' ? 'var(--color-surface-hover)' : 'var(--accent-veil)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: msg.role === 'user' ? 'var(--color-text)' : 'var(--color-primary)'
            }}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div style={{ 
              background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
              border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              borderTopRightRadius: msg.role === 'user' ? 0 : 'var(--radius-md)',
              borderTopLeftRadius: msg.role === 'assistant' ? 0 : 'var(--radius-md)',
              maxWidth: '80%',
              lineHeight: 1.5,
              fontSize: '0.95rem',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-veil)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-primary)'
            }}>
              <Bot size={16} />
            </div>
            <div style={{ 
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1rem',
              borderRadius: 'var(--radius-md)', borderTopLeftRadius: 0, maxWidth: '80%', display: 'flex', alignItems: 'center'
            }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div style={{ padding: '1.25rem', borderTop: '1px solid var(--color-border)', background: 'var(--panel-subtle)' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'var(--color-surface)', 
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.5rem'
        }}>
          <textarea 
            placeholder="Ask about your notebook..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              resize: 'none',
              padding: '0.5rem',
              outline: 'none',
              minHeight: '24px',
              height: '24px',
              maxHeight: '120px',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              lineHeight: '24px'
            }}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            style={{ 
              background: input.trim() ? 'var(--color-primary)' : 'var(--color-surface-hover)', 
              color: input.trim() ? 'var(--shell-bg)' : 'var(--color-text-muted)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              transition: 'var(--transition)',
              flexShrink: 0,
              marginLeft: '0.5rem'
            }}
          >
            <Send size={16} style={{ marginLeft: '2px' }} />
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          AI can make mistakes. Verify important information.
        </div>
      </div>
    </div>
  );
}
