import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, X, MessageSquare, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminClient } from '../api/adminClient';
import {
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketCategory,
} from '@calmeter/shared';

export const SupportTicketsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tickets', page, statusFilter, priorityFilter, categoryFilter],
    queryFn: () =>
      adminClient.listTickets({
        page,
        limit: 15,
        status: statusFilter ? (statusFilter as SupportTicketStatus) : undefined,
        priority: priorityFilter ? (priorityFilter as SupportTicketPriority) : undefined,
        category: categoryFilter ? (categoryFilter as SupportTicketCategory) : undefined,
      }),
  });

  const { data: ticketDetails, refetch: refetchDetails } = useQuery({
    queryKey: ['admin', 'ticket', selectedTicketId],
    queryFn: () => adminClient.getTicketDetails(selectedTicketId!),
    enabled: !!selectedTicketId,
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminClient.updateTicket(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      refetchDetails();
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminClient.addTicketNote(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      refetchDetails();
      setNewNote('');
    },
  });

  const tickets = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const getPriorityBadge = (priority: SupportTicketPriority) => {
    switch (priority) {
      case SupportTicketPriority.URGENT:
        return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case SupportTicketPriority.HIGH:
        return 'bg-amber-500/10 text-amber-300 border border-amber-500/30';
      case SupportTicketPriority.MEDIUM:
        return 'bg-zinc-800 text-zinc-300';
      case SupportTicketPriority.LOW:
      default:
        return 'bg-zinc-900 text-zinc-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Customer Support Operations
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Resolve user inquiries, track AI scan issues, troubleshoot billing discrepancies, and
            append internal staff notes.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            <option value="">All Statuses</option>
            <option value={SupportTicketStatus.OPEN}>Open</option>
            <option value={SupportTicketStatus.IN_PROGRESS}>In Progress</option>
            <option value={SupportTicketStatus.WAITING_ON_USER}>Waiting on User</option>
            <option value={SupportTicketStatus.RESOLVED}>Resolved</option>
            <option value={SupportTicketStatus.CLOSED}>Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            <option value="">All Priorities</option>
            <option value={SupportTicketPriority.URGENT}>Urgent</option>
            <option value={SupportTicketPriority.HIGH}>High</option>
            <option value={SupportTicketPriority.MEDIUM}>Medium</option>
            <option value={SupportTicketPriority.LOW}>Low</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            <option value="">All Categories</option>
            <option value={SupportTicketCategory.ACCOUNT_BILLING}>Account & Billing</option>
            <option value={SupportTicketCategory.AI_SCAN_FAILURE}>AI Scan Issue</option>
            <option value={SupportTicketCategory.FOOD_DATABASE}>Food Database</option>
            <option value={SupportTicketCategory.BUG_REPORT}>Bug Report</option>
            <option value={SupportTicketCategory.GENERAL_INQUIRY}>General Inquiry</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Assigned Admin</th>
              <th className="py-3 px-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  Loading support tickets...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-500">
                  No support tickets match the selected filters.
                </td>
              </tr>
            ) : (
              tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{t.subject}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {new Date(t.createdAt).toLocaleDateString()} • {t.notesCount} internal notes
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">{t.userEmail}</td>
                  <td className="py-3 px-4 text-zinc-400 text-[11px]">{t.category}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getPriorityBadge(t.priority)}`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-[11px] text-zinc-300">{t.status}</span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400 text-[11px]">{t.assignedAdminName}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedTicketId(t.id)}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white"
                      title="Inspect & Respond"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950">
          <div>
            Page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.total}{' '}
            tickets)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Details & Notes Drawer */}
      {selectedTicketId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-xl h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Ticket Resolution Thread</h3>
                <p className="text-zinc-500 font-mono text-[11px]">{selectedTicketId}</p>
              </div>
              <button
                onClick={() => setSelectedTicketId(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {ticketDetails ? (
              <div className="space-y-6 text-xs">
                {/* Header info */}
                <div className="bg-zinc-900/50 p-4 rounded border border-zinc-850 space-y-2">
                  <div className="font-bold text-white text-sm">{ticketDetails.subject}</div>
                  <div className="text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {ticketDetails.message}
                  </div>
                  <div className="pt-2 text-[11px] text-zinc-500">
                    From: {ticketDetails.userEmail || 'Anonymous'}
                  </div>
                </div>

                {/* Status & Priority controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Update Status</label>
                    <select
                      value={ticketDetails.status}
                      onChange={e =>
                        updateTicketMutation.mutate({
                          id: selectedTicketId,
                          data: { status: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="WAITING_ON_USER">WAITING ON USER</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Update Priority</label>
                    <select
                      value={ticketDetails.priority}
                      onChange={e =>
                        updateTicketMutation.mutate({
                          id: selectedTicketId,
                          data: { priority: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                {/* Internal Notes Thread */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-zinc-400" />
                    <span>Internal Staff Notes ({ticketDetails.notes?.length || 0})</span>
                  </h4>

                  <div className="space-y-2">
                    {ticketDetails.notes && ticketDetails.notes.length > 0 ? (
                      ticketDetails.notes.map((note: any) => (
                        <div
                          key={note.id}
                          className="p-3 rounded bg-zinc-900 border border-zinc-850 space-y-1"
                        >
                          <div className="flex justify-between items-center text-[10px] text-zinc-500">
                            <span className="font-semibold text-zinc-300">
                              {note.admin.name} ({note.admin.role})
                            </span>
                            <span className="font-mono">
                              {new Date(note.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed">{note.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-500 text-xs">No internal notes added yet.</p>
                    )}
                  </div>

                  {/* Add Note Input */}
                  <div className="pt-2 flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Add an internal staff note..."
                      className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      disabled={!newNote.trim() || addNoteMutation.isPending}
                      onClick={() =>
                        addNoteMutation.mutate({ id: selectedTicketId, note: newNote.trim() })
                      }
                      className="px-3 py-2 bg-white hover:bg-zinc-200 text-black font-medium rounded text-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Post Note</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 text-xs">
                Loading ticket details...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
