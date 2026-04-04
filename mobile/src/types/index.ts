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
  follower_count?: number;
  following_count?: number;
  is_following?: boolean;
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
  difficulty: 'easy' | 'moderate' | 'hard';
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
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  trail_type: TrailType;
  is_multi_day: boolean;
  total_days: number | null;
  transport_access: string;
  walking_surface: 'paved' | 'mixed' | 'unpaved';
  view_count: number;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  updated_at: string;
}

export type TrailType =
  | 'urban'
  | 'coastal'
  | 'village'
  | 'cultural'
  | 'nature'
  | 'mixed';

export interface GeoJSONLineString {
  type: 'LineString';
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
  | 'start'
  | 'restaurant'
  | 'cafe'
  | 'photo'
  | 'rest'
  | 'view'
  | 'danger'
  | 'end';

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

export interface UserBadge {
  id: number;
  badge_type: string;
  earned_at: string;
}

export interface ActivityTrack {
  id: number;
  user: User;
  trail: number | null;
  story: number | null;
  source: string;
  track_points?: TrackPoint[];
  title: string;
  started_at: string | null;
  finished_at: string | null;
  total_steps: number | null;
  distance_km: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  elevation_gain_m: number | null;
  avg_pace_min_km: string | null;
  is_public: boolean;
  created_at: string;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string | null;
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

export interface PaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}
