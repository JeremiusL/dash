async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  completions: string[];
  streak: number;
  completedToday: boolean;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  topic: string;
  createdAt: string;
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  pdf?: {
    fileName: string;
    storedName: string;
    size: number;
  };
}

export type ReadingStatus = "todo" | "in-progress" | "done";

export interface ReadingItem {
  id: string;
  title: string;
  url?: string;
  status: ReadingStatus;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  allDay: boolean;
  link?: string;
  calendar?: string;
  source: "google" | "apple";
}

export interface CalendarProviderStatus {
  configured: boolean;
  connected: boolean;
}

export interface CalendarStatus {
  google: CalendarProviderStatus;
  apple: CalendarProviderStatus;
}

export interface CalendarWeek {
  events: CalendarEvent[];
  weekStart: string;
  weekEnd: string;
}

export interface DayUsage {
  date: string;
  tokens: number;
  messages: number;
}

export interface UsageSummary {
  available: boolean;
  days: DayUsage[];
  todayTokens: number;
  todayMessages: number;
  weekTokens: number;
  updatedAt: string;
}

export interface AccountLoginStatus {
  loggedIn: boolean;
}

export interface JobExecution {
  name: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
}

export interface AzureJob {
  name: string;
  status: string;
  lastRunTime: string | null;
  executions: JobExecution[];
}

export interface AzureJobsSummary {
  configured: boolean;
  jobs: AzureJob[];
  error?: string;
}

export interface AzureResourceCost {
  name: string;
  cost: number;
}

export interface AzureCreditSummary {
  currency: string;
  total: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  startDate: string;
  expiresAt: string;
  daysRemaining: number;
}

export interface AzureCostSummary {
  configured: boolean;
  currency?: string;
  monthToDateCost?: number;
  byResource?: AzureResourceCost[];
  credit?: AzureCreditSummary | null;
  error?: string;
  creditError?: string;
}

export interface OutreachDraft {
  partitionKey: string;
  rowKey: string;
  companyName: string;
  companyDomain: string;
  companyCountry: string;
  employeeCount?: number;
  contactName?: string;
  contactTitle?: string;
  contactEmail: string;
  researchSummary: string;
  emailSubject: string;
  emailBody: string;
  status: "pending_review" | "sending" | "sent" | "rejected";
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  source: string;
}

export interface OutreachDraftsSummary {
  configured: boolean;
  drafts: OutreachDraft[];
  error?: string;
}

export interface AccountUsage {
  loggedIn: true;
  planName: string | null;
  session: { percent: number; resetsAt: string } | null;
  weekly: { percent: number; resetsAt: string } | null;
  credits: { enabled: boolean; percent: number; used: number; limit: number; currency: string } | null;
}

export interface ChessDayRecord {
  completedAt: string;
  exerciseType: string;
  accuracyPct: number | null;
  timeSpentSec: number;
}

export interface ChessProgress {
  linkedHabitId: string | null;
  startDate: string | null;
  cycle: number;
  cycleLength: number;
  days: Record<number, ChessDayRecord>;
  todayDayNumber: number;
  todayCompleted: boolean;
  streak: number;
  cycleFinished: boolean;
}

export const api = {
  auth: {
    session: () => request<{ ok: true }>("/auth/session"),
    login: (password: string) => request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
    logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  },
  habits: {
    list: () => request<Habit[]>("/habits"),
    create: (name: string) => request<Habit>("/habits", { method: "POST", body: JSON.stringify({ name }) }),
    remove: (id: string) => request<void>(`/habits/${id}`, { method: "DELETE" }),
    checkin: (id: string) => request<Habit>(`/habits/${id}/checkin`, { method: "POST" }),
  },
  learning: {
    links: {
      list: () => request<LinkItem[]>("/learning/links"),
      create: (data: { title: string; url: string; topic?: string }) =>
        request<LinkItem>("/learning/links", { method: "POST", body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/learning/links/${id}`, { method: "DELETE" }),
    },
    notes: {
      list: () => request<NoteItem[]>("/learning/notes"),
      create: (data: { title: string; body?: string; topic?: string }) =>
        request<NoteItem>("/learning/notes", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: { title?: string; body?: string; topic?: string }) =>
        request<NoteItem>(`/learning/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/learning/notes/${id}`, { method: "DELETE" }),
      uploadPdf: async (data: { title: string; topic?: string; file: File }) => {
        const form = new FormData();
        form.append("title", data.title);
        if (data.topic) form.append("topic", data.topic);
        form.append("pdf", data.file);
        const res = await fetch("/api/learning/notes/pdf", { method: "POST", body: form, credentials: "include" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed: ${res.status}`);
        }
        return res.json() as Promise<NoteItem>;
      },
      pdfUrl: (id: string) => `/api/learning/notes/${id}/pdf`,
    },
    readingList: {
      list: () => request<ReadingItem[]>("/learning/reading-list"),
      create: (data: { title: string; url?: string }) =>
        request<ReadingItem>("/learning/reading-list", { method: "POST", body: JSON.stringify(data) }),
      setStatus: (id: string, status: ReadingStatus) =>
        request<ReadingItem>(`/learning/reading-list/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
      remove: (id: string) => request<void>(`/learning/reading-list/${id}`, { method: "DELETE" }),
    },
  },
  calendar: {
    status: () => request<CalendarStatus>("/calendar/status"),
    authUrl: () => request<{ url: string }>("/calendar/auth-url"),
    events: () => request<CalendarWeek>("/calendar/events"),
  },
  usage: {
    summary: () => request<UsageSummary>("/usage"),
  },
  account: {
    status: () => request<AccountLoginStatus>("/account/status"),
    login: () => request<AccountLoginStatus>("/account/login", { method: "POST" }),
    usage: () => request<AccountUsage>("/account/usage"),
  },
  jobs: {
    list: () => request<AzureJobsSummary>("/jobs"),
    costs: () => request<AzureCostSummary>("/jobs/costs"),
    start: (name: string) =>
      request<{ started: boolean; executionName: string | null }>(`/jobs/${encodeURIComponent(name)}/start`, {
        method: "POST",
      }),
  },
  deploy: {
    buckets: () => request<{ buckets: { key: string; repo: string }[] }>("/deploy/buckets"),
    build: (data: { repo: string; workflowFile: string; imageTag: string; ref?: string; agentPath?: string }) =>
      request<{ success: boolean; conclusion: string | null; runUrl?: string; error?: string }>("/deploy/build", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createJob: (data: { jobName: string; image: string; cronExpression: string }) =>
      request<{ success: boolean; jobName?: string; error?: string }>("/deploy/job", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createRepo: async (bucket: string, agentName: string, files: File[]) => {
      const form = new FormData();
      form.append("bucket", bucket);
      form.append("agentName", agentName);
      for (const file of files) form.append("files", file, file.name);
      const res = await fetch("/api/deploy/repo", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      return res.json() as Promise<{
        success: boolean;
        repo?: string;
        workflowFile?: string;
        agentPath?: string;
        imageName?: string;
        suggestedJobName?: string;
        error?: string;
      }>;
    },
  },
  outreach: {
    list: (status?: string) =>
      request<OutreachDraftsSummary>(`/outreach${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    update: (id: string, data: { emailSubject?: string; emailBody?: string }) =>
      request<{ success: boolean; error?: string }>(`/outreach/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    approve: (id: string) =>
      request<{ success: boolean; error?: string }>(`/outreach/${encodeURIComponent(id)}/approve`, { method: "POST" }),
    reject: (id: string) =>
      request<{ success: boolean; error?: string }>(`/outreach/${encodeURIComponent(id)}/reject`, { method: "POST" }),
  },
  chess: {
    state: () => request<ChessProgress>("/chess/state"),
    linkHabit: (habitId: string) =>
      request<ChessProgress>("/chess/link-habit", { method: "POST", body: JSON.stringify({ habitId }) }),
    complete: (data: { day: number; exerciseType: string; accuracyPct: number | null; timeSpentSec: number }) =>
      request<ChessProgress>("/chess/complete", { method: "POST", body: JSON.stringify(data) }),
    extend: () => request<ChessProgress>("/chess/extend", { method: "POST" }),
  },
};
