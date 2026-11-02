export type PostStatus = "planned" | "rendered" | "draft_created" | "approved" | "scheduled" | "published" | "rejected" | "failed";

export type Post = {
  id: number;
  created_at: string;
  plan_date: string;
  pillar: string | null;
  format: "reel" | "carousel" | "single" | "story" | string | null;
  property_key: string | null;
  status: PostStatus;
  plan: { properties?: { key: string; name: string; area: string }[]; photos?: { room: string; motif: string }[] } | null;
  copy: {
    hook?: string;
    captions?: { instagram?: string; facebook?: string; tiktok?: string };
    hashtags?: string[];
    lines?: { headline?: string; sub?: string }[];
    warnings?: string[];
  } | null;
  media: { type: "video" | "image"; keys: string[] } | null;
  mediaUrls?: string[];
  ghl: Record<string, { ok?: boolean; id?: string | null; skipped?: string }> | null;
  scheduled_for: string | null;
  feedback: string | null;
  error: string | null;
};

export type Property = {
  key: string;
  name: string;
  area: string | null;
  type: string | null;
  guests: number | null;
  active: boolean;
  open_questions: string | null;
  last_posted_at: string | null;
  good_photos: number;
  photos: number;
};
