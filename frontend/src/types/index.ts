export interface User {
  id: number;
  nickname: string;
  email?: string;
  profile_image: string | null;
  bio: string;
  preferred_language: string;
  is_guide: boolean;
  is_staff?: boolean;
  is_verified?: boolean;
  verification_level?: number;
  age_range?: string | null;
  walking_style?: string | null;
  companion_rating?: string | null;
  total_walks?: number;
  companion_count?: number;
  one_liner?: string;
  trail_count?: number;
  review_count?: number;
  badges?: UserBadge[];
  created_at?: string;
}

export interface Tag {
  id: number;
  name: string;
  name_en: string;
  name_ja: string;
}

export interface Trail {
  id: number;
  author: User;
  title: string;
  title_en?: string;
  title_ja?: string;
  description: string;
  description_en?: string;
  description_ja?: string;
  region: string;
  country: string;
  distance_km: string;
  estimated_minutes: number;
  difficulty: "easy" | "moderate" | "hard";
  elevation_gain: number | null;
  start_lat: string;
  start_lng: string;
  end_lat: string;
  end_lng: string;
  path_data: GeoJSONLineString;
  cover_image: string;
  thumbnail_url?: string;
  tags: Tag[];
  best_season: string;
  status: "draft" | "pending" | "approved" | "rejected";
  rejection_reason?: string;
  view_count: number;
  like_count: number;
  is_liked: boolean;
  // Phase 7: 도보여행 필드
  trail_type: TrailType;
  is_multi_day: boolean;
  total_days: number | null;
  transport_access: string;
  walking_surface: "paved" | "mixed" | "unpaved";
  created_at: string;
  updated_at: string;
}

export type TrailType = "urban" | "coastal" | "village" | "cultural" | "nature" | "mixed";

// Phase 8: 동행 매칭
export interface WalkPlan {
  id: number;
  user: User;
  trail: Trail;
  planned_date: string;
  planned_time: string | null;
  message: string;
  pace: "slow" | "moderate" | "fast";
  companion_status: "open" | "matched" | "closed" | "completed";
  max_companions: number;
  preferred_gender: "any" | "male" | "female";
  preferred_age_range: string;
  accepted_count: number;
  is_visible: boolean;
  created_at: string;
}

export interface CompanionRequest {
  id: number;
  requester: User;
  walk_plan: number;
  message: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
}

export interface CompanionReview {
  id: number;
  reviewer: User;
  reviewed_user: User;
  walk_plan: number;
  rating: number;
  tags: string[];
  content: string;
  created_at: string;
}

export interface ChatRoom {
  id: number;
  walk_plan: number;
  walk_plan_title?: string;
  participants: User[];
  last_message?: ChatMessage;
  unread_count: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  room: number;
  sender: User;
  content: string;
  created_at: string;
}

// Phase 10: 스토리
export interface StoryComment {
  id: number;
  author: User;
  content: string;
  like_count: number;
  parent: number | null;
  replies: StoryComment[];
  is_liked: boolean;
  created_at: string;
}

export interface WalkStory {
  id: number;
  walk_plan: number;
  author: User;
  title: string;
  content: string;
  mood: string;
  photos: StoryPhoto[];
  companions_tagged: User[];
  like_count: number;
  is_liked: boolean;
  trail_title: string | null;
  trail_region: string | null;
  trail_id: number | null;
  comment_count: number;
  comments?: StoryComment[];
  created_at: string;
}

export interface StoryPhoto {
  id: number;
  image: string;
  caption: string;
  order: number;
}

// Phase 11: 배지
export interface UserBadge {
  id: number;
  badge_type: string;
  earned_at: string;
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface Spot {
  id: number;
  trail: number;
  author: number;
  author_nickname?: string;
  name: string;
  name_en: string;
  name_ja: string;
  spot_type: SpotType;
  lat: string;
  lng: string;
  order: number;
  distance_from_start_km: string;
  description: string;
  menu_highlight: string;
  price_range: string;
  rating: string | null;
  tip: string;
  images: SpotImage[];
  status: string;
  created_at: string;
}

export type SpotType =
  | "start"
  | "restaurant"
  | "cafe"
  | "photo"
  | "rest"
  | "view"
  | "danger"
  | "end";

export interface SpotImage {
  id: number;
  image: string;
  order: number;
}

export interface Review {
  id: number;
  trail: number;
  author: User;
  rating: number;
  content: string;
  visited_date: string;
  images: ReviewImage[];
  helpful_count: number;
  status: string;
  created_at: string;
}

export interface ReviewImage {
  id: number;
  image: string;
  order: number;
}

export interface PaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

// ──────────────────────────────────────
// Community v2
// ──────────────────────────────────────

export type PostCategory = 'free' | 'qna' | 'recommend' | 'review' | 'meetup' | 'tip';

export interface CommunityPost {
  id: number;
  author: number;
  author_nickname: string;
  author_image: string | null;
  category: PostCategory;
  category_display: string;
  title: string;
  content?: string;
  thumbnail: string | null;
  images?: { id: number; image: string; order: number }[];
  trail?: number | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  bookmark_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_mine: boolean;
  is_pinned: boolean;
  comments?: PostComment[];
  created_at: string;
  updated_at?: string;
}

export interface PostComment {
  id: number;
  author: number;
  author_nickname: string;
  author_image: string | null;
  parent: number | null;
  content: string;
  like_count: number;
  replies: PostComment[];
  is_liked: boolean;
  is_mine: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityGroup {
  id: number;
  name: string;
  description: string;
  category: string;
  category_display: string;
  emoji: string;
  cover_image: string | null;
  owner: number;
  owner_nickname: string;
  region: string;
  member_count: number;
  max_members: number;
  is_public: boolean;
  is_member: boolean;
  members?: GroupMember[];
  recent_messages?: GroupMessage[];
  created_at: string;
}

export interface GroupMember {
  id: number;
  user: number;
  nickname: string;
  profile_image: string | null;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface GroupMessage {
  id: number;
  sender: number;
  sender_nickname: string;
  sender_image: string | null;
  content: string;
  image: string | null;
  created_at: string;
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  emoji: string;
  cover_image: string | null;
  challenge_type: 'distance' | 'steps' | 'streak' | 'trails' | 'elevation';
  type_display: string;
  goal_value: number;
  goal_unit: string;
  status: 'upcoming' | 'active' | 'ended';
  status_display: string;
  start_date: string;
  end_date: string;
  participant_count: number;
  max_participants: number;
  is_joined: boolean;
  my_progress: number;
  leaderboard?: ChallengeParticipant[];
}

export interface ChallengeParticipant {
  id: number;
  user: number;
  nickname: string;
  profile_image: string | null;
  current_value: number;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  joined_at: string;
}

// GPS/Activity Tracking
export interface TrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string | null;
}

export type ActivitySource =
  | "manual_gpx" | "apple_watch" | "garmin"
  | "samsung_health" | "google_fit" | "cashwalk" | "phone_gps" | "strava";

export interface ActivityTrack {
  id: number;
  user: User;
  trail: number | null;
  story: number | null;
  source: ActivitySource;
  track_points?: TrackPoint[];
  title: string;
  started_at: string | null;
  finished_at: string | null;
  total_steps: number | null;
  distance_km: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  max_elevation_m: string | null;
  min_elevation_m: string | null;
  avg_speed_kmh: string | null;
  max_speed_kmh: string | null;
  avg_pace_min_km: string | null;
  is_public: boolean;
  created_at: string;
}

export interface ActivityStats {
  total_distance_km: number;
  total_steps: number;
  total_duration_minutes: number;
  total_calories: number;
  track_count: number;
  weekly: {
    date: string;
    total_steps: number;
    total_distance_km: string;
    total_duration_minutes: number;
    total_calories: number;
    track_count: number;
  }[];
}
