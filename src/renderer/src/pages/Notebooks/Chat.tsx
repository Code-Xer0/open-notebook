import React, { useState, useEffect } from 'react';
import { Send, Bot, User, Sparkles, MoreVertical, Loader2, BookOpen, Plus, Search } from 'lucide-react';
import { api } from '../../services/api';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CredentialStatus } from '../../types/runtime';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface BackendChatMessage {
  id?: string;
  type?: string;
  content?: string;
}

interface ChatSetupState {
  checking: boolean;
  ready: boolean;
  reason: string;
  modelLabel?: string;
}

interface BackendModel {
  id: string;
  name: string;
  provider: string;
  type: string;
  credential?: string | null;
}

interface NotebookSummary {
  id?: string;
  name?: string;
  title?: string;
  sources?: unknown[];
}

function getApiErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || JSON.stringify(item)).join('; ');
  return error?.message || 'Failed to connect to AI backend';
}

export function Chat() {
  const { id: notebookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Ask a question about this notebook. Answers should be checked against cited source passages.' }
  ]);
  const [input, setInput] = useState('');
  const [notebookSearch, setNotebookSearch] = useState('');
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [notebooksLoading, setNotebooksLoading] = useState(false);
  const [notebooksError, setNotebooksError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [contextStatus, setContextStatus] = useState<string>('Select a notebook with sources before asking grounded questions.');
  const [chatSetup, setChatSetup] = useState<ChatSetupState>({
    checking: true,
    ready: false,
    reason: 'Checking backend provider and model setup.'
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setSessionId(null);
      if (!notebookId) {
        setContextStatus('No notebook selected. Open chat from a notebook to build grounded context.');
        return;
      }

      try {
        const sessions = await api.chat.getSessions(notebookId);
        if (cancelled) return;
        const firstSession = Array.isArray(sessions) ? sessions[0] : null;
        if (firstSession?.id) {
          setSessionId(firstSession.id);
          setContextStatus('Notebook session loaded. Context will be rebuilt before each answer.');
        } else {
          setContextStatus('Notebook selected. A chat session will be created on first message.');
        }
      } catch (error: any) {
        if (!cancelled) {
          setContextStatus(`Could not load notebook chat sessions: ${getApiErrorMessage(error)}`);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotebooks() {
      if (notebookId) return;
      setNotebooksLoading(true);
      setNotebooksError(null);
      try {
        const data = await api.notebooks.list();
        if (cancelled) return;
        setNotebooks(Array.isArray(data) ? data : []);
      } catch (error: any) {
        if (!cancelled) {
          setNotebooksError(getApiErrorMessage(error));
        }
      } finally {
        if (!cancelled) setNotebooksLoading(false);
      }
    }

    void loadNotebooks();
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  useEffect(() => {
    let cancelled = false;

    async function loadChatSetup() {
      setChatSetup({
        checking: true,
        ready: false,
        reason: 'Checking backend provider and model setup.'
      });

      try {
        const [credentialStatus, defaults, models] = await Promise.all([
          api.credentials.status(),
          api.models.getDefaults(),
          api.models.list()
        ]) as [CredentialStatus, any, BackendModel[]];

        if (cancelled) return;

        const defaultChatModelId = defaults?.default_chat_model;
        if (!defaultChatModelId) {
          setChatSetup({
            checking: false,
            ready: false,
            reason: 'Blocked: no backend default chat model is set.'
          });
          return;
        }

        const model = (Array.isArray(models) ? models : []).find(
          (item: BackendModel) => item.id === defaultChatModelId
        ) as BackendModel | undefined;
        if (!model) {
          setChatSetup({
            checking: false,
            ready: false,
            reason: 'Blocked: the default chat model record could not be found.'
          });
          return;
        }

        const providerPresent = Boolean(credentialStatus?.present?.[model.provider] || credentialStatus?.configured?.[model.provider]);
        const providerUsable = Boolean(credentialStatus?.usable?.[model.provider]);
        if (!providerUsable) {
          setChatSetup({
            checking: false,
            ready: false,
            reason: providerPresent
              ? `Blocked: ${model.provider} is present but has no passing backend credential test.`
              : `Blocked: ${model.provider} credential is not configured in the backend.`,
            modelLabel: `${model.provider}/${model.name}`
          });
          return;
        }

        setChatSetup({
          checking: false,
          ready: true,
          reason: `Ready with tested backend default model ${model.provider}/${model.name}.`,
          modelLabel: `${model.provider}/${model.name}`
        });
      } catch (error: any) {
        if (!cancelled) {
          setChatSetup({
            checking: false,
            ready: false,
            reason: `Blocked: setup status unavailable - ${getApiErrorMessage(error)}`
          });
        }
      }
    }

    void loadChatSetup();

    return () => {
      cancelled = true;
    };
  }, []);

  const ensureSession = async (): Promise<string> => {
    if (!notebookId) {
      throw new Error('No notebook selected.');
    }
    if (sessionId) return sessionId;
    const session = await api.chat.createSession({
      notebook_id: notebookId,
      title: 'Notebook chat'
    });
    if (!session?.id) {
      throw new Error('Backend did not return a chat session id.');
    }
    setSessionId(session.id);
    return session.id;
  };

  const sendBlockedReason = !notebookId
    ? 'Select a notebook before sending a grounded question.'
    : chatSetup.ready
      ? ''
      : chatSetup.reason;

  const canSend = Boolean(input.trim() && notebookId && !loading && chatSetup.ready);
  const filteredNotebooks = notebooks.filter((notebook) => {
    const label = notebook.name || notebook.title || 'Untitled notebook';
    return label.toLowerCase().includes(notebookSearch.toLowerCase());
  });

  const handleSend = async () => {
    if (!canSend) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const activeSessionId = await ensureSession();
      const contextResponse = await api.chat.buildContext({
        notebook_id: notebookId,
        context_config: {}
      });

      if (!contextResponse?.char_count) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Blocked: this notebook has no source context yet. Add sources before asking grounded questions.'
        }]);
        setContextStatus('Blocked: context build returned zero characters.');
        return;
      }

      setContextStatus(`Using ${contextResponse.char_count} grounded context characters from this notebook.`);
      const response = await api.chat.execute({
        session_id: activeSessionId,
        message: userMessage,
        context: contextResponse.context
      });
      
      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const responseMessages: BackendChatMessage[] = Array.isArray(response.messages) ? response.messages : [];
      const latestAssistant = [...responseMessages].reverse().find((msg) => msg.type === 'ai' || msg.type === 'assistant');
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: latestAssistant?.content || 'No assistant response was returned by the backend.'
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: `Error: ${getApiErrorMessage(error)}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async () => {
    try {
      setNotebooksLoading(true);
      const notebook = await api.notebooks.create({ name: 'New Notebook' });
      const id = notebook?.id;
      if (id) {
        navigate(`/chat/${encodeURIComponent(id)}`);
        return;
      }
      const data = await api.notebooks.list();
      setNotebooks(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setNotebooksError(getApiErrorMessage(error));
    } finally {
      setNotebooksLoading(false);
    }
  };

  return (
    <div className="glass-card chat-shell">
      {/* Chat Header */}
      <div className="chat-header" style={{
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
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{notebookId ? contextStatus : 'No notebook selected'}</span>
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="chat-scroll">
        {!notebookId ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <BookOpen size={24} />
            </div>
            <div>
              <h2>Choose a notebook to chat with</h2>
              <p>Grounded chat needs a notebook so CODEX can build source context before sending anything to a model.</p>
            </div>

            <div className="chat-notebook-picker">
              <label className="chat-search-box">
                <Search size={16} />
                <input
                  value={notebookSearch}
                  onChange={(event) => setNotebookSearch(event.target.value)}
                  placeholder="Search notebooks..."
                />
              </label>
              <div className="chat-notebook-list">
                {notebooksLoading && (
                  <div className="chat-picker-status">
                    <Loader2 size={16} className="animate-spin" /> Loading notebooks...
                  </div>
                )}
                {!notebooksLoading && notebooksError && (
                  <div className="chat-picker-status error-text">{notebooksError}</div>
                )}
                {!notebooksLoading && !notebooksError && filteredNotebooks.map((notebook, index) => (
                  <button
                    key={notebook.id || index}
                    className="chat-notebook-row"
                    onClick={() => notebook.id && navigate(`/chat/${encodeURIComponent(notebook.id)}`)}
                    disabled={!notebook.id}
                  >
                    <BookOpen size={16} />
                    <span>{notebook.name || notebook.title || `Notebook ${index + 1}`}</span>
                    <small>{notebook.sources?.length ?? 'Unknown'} sources</small>
                  </button>
                ))}
                {!notebooksLoading && !notebooksError && filteredNotebooks.length === 0 && (
                  <div className="chat-picker-status">No notebooks found.</div>
                )}
              </div>
            </div>

            <div className="chat-empty-actions">
              <button className="btn primary" onClick={() => navigate('/notebooks')}>
                <BookOpen size={15} /> Open Library
              </button>
              <button className="btn" onClick={() => void handleCreateNotebook()}>
                <Plus size={15} /> New Notebook
              </button>
              <button className="btn" onClick={() => navigate('/sources')}>
                Add Sources
              </button>
            </div>
          </div>
        ) : messages.map((msg) => (
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
              minWidth: 0,
              lineHeight: 1.5,
              fontSize: '0.95rem',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {notebookId && loading && (
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
      {notebookId && (
      <div className="chat-composer" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--panel-subtle)' }}>
        {!chatSetup.ready && (
          <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--signal-warning)', background: 'var(--warning-veil)', color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem' }}>{chatSetup.checking ? 'Checking chat setup...' : `${chatSetup.reason} You can still draft a prompt; sending stays blocked until this passes.`}</span>
            {!chatSetup.checking && <Link to="/settings" className="btn" style={{ textDecoration: 'none' }}>Open Settings</Link>}
          </div>
        )}
        <div className="chat-input-frame" style={{
          background: 'var(--color-surface)', 
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)'
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
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '0.95rem'
            }}
          />
          <button 
            onClick={handleSend}
            disabled={!canSend}
            title={canSend ? 'Send grounded question' : sendBlockedReason}
            style={{ 
              background: canSend ? 'var(--color-primary)' : 'var(--color-surface-hover)',
              color: canSend ? 'var(--shell-bg)' : 'var(--color-text-muted)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'var(--transition)',
              flexShrink: 0
            }}
          >
            <Send size={16} style={{ marginLeft: '2px' }} />
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          AI can make mistakes. Verify important information.
        </div>
      </div>
      )}
    </div>
  );
}
