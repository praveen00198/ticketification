import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Eye,
  Star,
  Plus,
  RefreshCw,
  Copy,
  Trash2,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  CheckCheck,
  FileText,
} from 'lucide-react';
import {
  eventsApi,
  EventCredentialTemplate,
  TemplatePresetId,
  EventCredentialTemplateField,
} from '../../api/events';

interface EventCredentialTemplateCardProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

export const EventCredentialTemplateCard: React.FC<EventCredentialTemplateCardProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [templates, setTemplates] = useState<EventCredentialTemplate[]>([]);
  const [defaultTemplate, setDefaultTemplate] = useState<EventCredentialTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState<EventCredentialTemplate | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [mockName, setMockName] = useState('Devika Sharma');
  const [mockRole, setMockRole] = useState('VIP PARTICIPANT');
  const [mockSequence, setMockSequence] = useState('BDG-00042');

  // Edit / Create Modal
  const [editingTemplate, setEditingTemplate] = useState<EventCredentialTemplate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDimensions, setEditDimensions] = useState({ width: 1620, height: 2025 });
  const [editFields, setEditFields] = useState<EventCredentialTemplateField[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Quick Render All
  const [renderingAll, setRenderingAll] = useState(false);

  const fetchTemplates = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await eventsApi.getCredentialTemplates(eventId);
      setTemplates(res.templates);
      setDefaultTemplate(res.defaultTemplate);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load credential templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [eventId]);

  const handleOpenPreview = async (template: EventCredentialTemplate) => {
    setPreviewTemplate(template);
    setPreviewUrl(null);
    try {
      setGeneratingPreview(true);
      setError(null);
      const res = await eventsApi.generateTemplatePreview(eventId, template._id, {
        name: mockName,
        role: mockRole,
        sequence: mockSequence,
      });
      setPreviewUrl(res.previewUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to generate template preview');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleRefreshPreview = async () => {
    if (!previewTemplate) return;
    try {
      setGeneratingPreview(true);
      setError(null);
      const res = await eventsApi.generateTemplatePreview(eventId, previewTemplate._id, {
        name: mockName,
        role: mockRole,
        sequence: mockSequence,
      });
      setPreviewUrl(res.previewUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update preview');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleClonePreset = async (presetId: TemplatePresetId) => {
    try {
      setError(null);
      const res = await eventsApi.clonePresetTemplate(eventId, presetId);
      setSuccessMsg(`Cloned ${res.name} to event templates!`);
      await fetchTemplates();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to clone preset');
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      setError(null);
      const res = await eventsApi.setDefaultCredentialTemplate(eventId, templateId);
      setSuccessMsg(`"${res.name}" is now the active default template!`);
      await fetchTemplates();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to set default template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      setError(null);
      await eventsApi.deleteCredentialTemplate(eventId, templateId);
      setSuccessMsg('Template deleted.');
      await fetchTemplates();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete template');
    }
  };

  const handleOpenEdit = (template?: EventCredentialTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setEditName(template.name);
      setEditDescription(template.description || '');
      setEditDimensions(template.dimensions || { width: 1620, height: 2025 });
      setEditFields(JSON.parse(JSON.stringify(template.fields || [])));
    } else {
      setEditingTemplate(null);
      setEditName('Custom Event Pass');
      setEditDescription('Custom visual layout with adjusted coordinates');
      setEditDimensions({ width: 1620, height: 2025 });
      setEditFields([
        {
          key: 'eventName',
          label: 'Event Title',
          x: 810,
          y: 380,
          fontSize: 46,
          fontFamily: 'Noto Sans, sans-serif',
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: 'center',
          visible: true,
        },
        {
          key: 'name',
          label: 'Attendee Name',
          x: 810,
          y: 840,
          fontSize: 64,
          fontFamily: 'Noto Sans, sans-serif',
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: 'center',
          visible: true,
        },
        {
          key: 'role',
          label: 'Role Category',
          x: 810,
          y: 940,
          fontSize: 36,
          fontFamily: 'Noto Sans, sans-serif',
          fontWeight: 'bold',
          color: '#10B981',
          textAlign: 'center',
          visible: true,
        },
        {
          key: 'qr',
          label: 'QR Code',
          x: 620,
          y: 1100,
          width: 380,
          height: 380,
          visible: true,
        },
        {
          key: 'sequence',
          label: 'Pass Number',
          x: 810,
          y: 1560,
          fontSize: 32,
          fontFamily: 'Noto Sans, sans-serif',
          fontWeight: 'bold',
          color: '#94A3B8',
          textAlign: 'center',
          visible: true,
        },
      ]);
    }
    setIsEditModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingTemplate(true);
      setError(null);

      if (editingTemplate) {
        await eventsApi.updateCredentialTemplate(eventId, editingTemplate._id, {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          dimensions: editDimensions,
          fields: editFields,
        });
        setSuccessMsg(`Template "${editName}" updated successfully!`);
      } else {
        await eventsApi.createCredentialTemplate(eventId, {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          dimensions: editDimensions,
          fields: editFields,
          isDefault: templates.filter((t) => t.eventId).length === 0,
        });
        setSuccessMsg(`Template "${editName}" created successfully!`);
      }

      setIsEditModalOpen(false);
      await fetchTemplates();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleFieldChange = (index: number, key: keyof EventCredentialTemplateField, value: any) => {
    const updated = [...editFields];
    updated[index] = { ...updated[index], [key]: value };
    setEditFields(updated);
  };

  const handleRenderAllPasses = async () => {
    try {
      setRenderingAll(true);
      setError(null);
      const res = await eventsApi.getEventCredentials(eventId, { limit: 50 });
      let renderedCount = 0;

      for (const cred of res.credentials) {
        await eventsApi.renderCredentialAsset(eventId, cred._id, defaultTemplate?._id);
        renderedCount++;
      }

      setSuccessMsg(`Successfully rendered & stored PNG visual assets for ${renderedCount} credentials!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed during batch credential rendering');
    } finally {
      setRenderingAll(false);
    }
  };

  return (
    <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <span>Credential Templates & Visual Designer</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Phase 13
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                Custom visual layouts, dynamic field coordinates (`&#123;&#123;name&#125;&#125;`, `&#123;&#123;qr&#125;&#125;`), and native Sharp presets.
              </p>
            </div>
          </div>
        </div>

        {isHostOrCoordinator && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRenderAllPasses}
              disabled={renderingAll || !defaultTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors border border-zinc-200 disabled:opacity-50"
              title="Render genuine PNG assets for issued passes with active template"
            >
              <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${renderingAll ? 'animate-spin' : ''}`} />
              <span>{renderingAll ? 'Rendering...' : 'Rasterize Issued Passes'}</span>
            </button>
            <button
              onClick={() => handleOpenEdit()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Template</span>
            </button>
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="p-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 rounded-lg transition-colors border border-zinc-200 disabled:opacity-50"
              title="Refresh templates"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active Template Banner */}
      {defaultTemplate && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-zinc-50 to-zinc-50 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500 text-white shadow-sm">
              <Star className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900">{defaultTemplate.name}</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Active Default
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {defaultTemplate.dimensions.width} × {defaultTemplate.dimensions.height} px • {defaultTemplate.fields.length} bound fields
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenPreview(defaultTemplate)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-200 transition-colors shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>Inspect Live Preview</span>
          </button>
        </div>
      )}

      {/* Global Presets Carousel */}
      <div>
        <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
          <span>Platform Presets</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 'CONFERENCE_BADGE', label: 'Conference Badge', desc: 'Portrait badge with large attendee name & role tag' },
            { id: 'CONCERT_TICKET', label: 'Concert & Festival', desc: 'Standard entry pass with branding & access code' },
            { id: 'HACKATHON_PASS', label: 'Hackathon Badge', desc: 'Dynamic hacker pass with team & track badges' },
            { id: 'WORKER_PASS', label: 'Staff & Worker Pass', desc: 'Reusable high-contrast pass with large QR' },
          ].map((preset) => {
            const isCloned = templates.some((t) => t.presetId === preset.id && t.eventId);

            return (
              <div
                key={preset.id}
                className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex flex-col justify-between hover:border-zinc-300 transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-zinc-900">{preset.label}</div>
                  <div className="text-[11px] text-zinc-500 mt-1 leading-snug">{preset.desc}</div>
                </div>

                <div className="pt-3 mt-2 border-t border-zinc-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400">1620 × 2025</span>
                  {isHostOrCoordinator && (
                    <button
                      onClick={() => handleClonePreset(preset.id as TemplatePresetId)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{isCloned ? 'Clone Again' : 'Clone Preset'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Templates List */}
      <div>
        <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-zinc-500" />
          <span>Configured Event Templates</span>
        </div>

        {loading && templates.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">Loading templates...</div>
        ) : (
          <div className="overflow-x-auto border border-zinc-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Template Name</th>
                  <th className="py-2.5 px-3">Preset Archetype</th>
                  <th className="py-2.5 px-3">Dimensions</th>
                  <th className="py-2.5 px-3">Fields</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isHostOrCoordinator && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {templates.map((t) => {
                  const isGlobal = !t.eventId;

                  return (
                    <tr key={t._id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-900">{t.name}</div>
                        {t.description && (
                          <div className="text-[11px] text-zinc-500 truncate max-w-[220px]">
                            {t.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-black uppercase">
                          {t.presetId}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-zinc-600">
                        {t.dimensions?.width} × {t.dimensions?.height}
                      </td>

                      <td className="py-3 px-3 text-zinc-600">
                        <span className="font-semibold">{t.fields?.length || 0} fields</span>
                      </td>

                      <td className="py-3 px-3">
                        {t.isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                            <span>Default</span>
                          </span>
                        ) : isGlobal ? (
                          <span className="text-[10px] font-semibold text-zinc-400">Global Preset</span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">Custom</span>
                        )}
                      </td>

                      {isHostOrCoordinator && (
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenPreview(t)}
                              className="p-1 text-zinc-400 hover:text-emerald-600 rounded-md transition-colors"
                              title="Inspect rendered Sharp preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {!t.isDefault && (
                              <button
                                onClick={() => handleSetDefault(t._id)}
                                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-bold rounded-lg border border-zinc-200 transition-colors"
                                title="Make active default"
                              >
                                Set Default
                              </button>
                            )}

                            {!isGlobal && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(t)}
                                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md transition-colors"
                                  title="Edit layout coordinates"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTemplate(t._id)}
                                  className="p-1 text-zinc-400 hover:text-rose-600 rounded-md transition-colors"
                                  title="Delete template"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Live Sharp Preview */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Sharp Rendered Preview — {previewTemplate.name}</span>
              </h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mock Test Data Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Attendee Name</label>
                <input
                  type="text"
                  value={mockName}
                  onChange={(e) => setMockName(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-zinc-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Role Badge</label>
                <input
                  type="text"
                  value={mockRole}
                  onChange={(e) => setMockRole(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-zinc-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Sequence ID</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={mockSequence}
                    onChange={(e) => setMockSequence(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-zinc-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    onClick={handleRefreshPreview}
                    disabled={generatingPreview}
                    className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shrink-0 disabled:opacity-50"
                    title="Regenerate Preview"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatingPreview ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Image Preview Canvas */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-center min-h-[320px]">
              {generatingPreview ? (
                <div className="text-center text-zinc-400 text-xs py-12 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                  <span>Rasterizing genuine PNG with Sharp C++ libvips...</span>
                </div>
              ) : previewUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={previewUrl}
                    alt="Rendered Credential"
                    className="max-h-[460px] w-auto rounded-lg shadow-2xl border border-zinc-700"
                  />
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Binary PNG Output • {previewTemplate.dimensions?.width} × {previewTemplate.dimensions?.height} px
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-xs">Preview failed to generate.</div>
              )}
            </div>

            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-[11px] text-zinc-400">
                Rendered with Sharp using level H error-corrected QR code and zero external network calls.
              </span>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit / Create Template */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>{editingTemplate ? `Edit ${editingTemplate.name}` : 'Create Custom Template'}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Template Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Field Coordinate Editor */}
              <div>
                <div className="font-bold text-zinc-800 uppercase tracking-wide text-[11px] mb-2">
                  Bound Field Layout & Coordinates (px)
                </div>
                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-500 uppercase">
                        <th className="py-2 px-2.5">Field</th>
                        <th className="py-2 px-2.5">X (px)</th>
                        <th className="py-2 px-2.5">Y (px)</th>
                        <th className="py-2 px-2.5">Size (px)</th>
                        <th className="py-2 px-2.5">Color</th>
                        <th className="py-2 px-2.5 text-center">Visible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {editFields.map((field, idx) => (
                        <tr key={field.key} className="hover:bg-zinc-50/50">
                          <td className="py-2 px-2.5 font-bold text-zinc-800">{field.label}</td>
                          <td className="py-2 px-2.5">
                            <input
                              type="number"
                              value={field.x}
                              onChange={(e) => handleFieldChange(idx, 'x', Number(e.target.value))}
                              className="w-16 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 font-mono text-zinc-900"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="number"
                              value={field.y}
                              onChange={(e) => handleFieldChange(idx, 'y', Number(e.target.value))}
                              className="w-16 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 font-mono text-zinc-900"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            {field.key === 'qr' ? (
                              <input
                                type="number"
                                value={field.width || 380}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  handleFieldChange(idx, 'width', val);
                                  handleFieldChange(idx, 'height', val);
                                }}
                                className="w-16 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 font-mono text-zinc-900"
                              />
                            ) : (
                              <input
                                type="number"
                                value={field.fontSize || 36}
                                onChange={(e) => handleFieldChange(idx, 'fontSize', Number(e.target.value))}
                                className="w-16 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 font-mono text-zinc-900"
                              />
                            )}
                          </td>
                          <td className="py-2 px-2.5">
                            {field.key !== 'qr' ? (
                              <input
                                type="text"
                                value={field.color || '#FFFFFF'}
                                onChange={(e) => handleFieldChange(idx, 'color', e.target.value)}
                                className="w-20 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 font-mono text-zinc-900"
                              />
                            ) : (
                              <span className="text-zinc-400 font-mono">B&amp;W</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={field.visible}
                              onChange={(e) => handleFieldChange(idx, 'visible', e.target.checked)}
                              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
