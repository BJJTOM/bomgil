import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import api from '../api/client';
import { colors } from '../theme/colors';
import Geolocation from '@react-native-community/geolocation';
import SafeMapView from '../components/SafeMapView';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '\uC26C\uC6C0' },
  { value: 'moderate', label: '\uBCF4\uD1B5' },
  { value: 'hard', label: '\uC5B4\uB824\uC6C0' },
];

const COUNTRY_OPTIONS = [
  { value: 'KR', label: '\uD55C\uAD6D' },
  { value: 'JP', label: '\uC77C\uBCF8' },
  { value: 'TW', label: '\uB300\uB9CC' },
  { value: 'TH', label: '\uD0DC\uAD6D' },
  { value: 'US', label: '\uBBF8\uAD6D' },
  { value: 'GB', label: '\uC601\uAD6D' },
  { value: 'FR', label: '\uD504\uB791\uC2A4' },
  { value: 'ES', label: '\uC2A4\uD398\uC778' },
];

const WAYPOINT_TYPES = [
  { value: 'restaurant', label: '\uB9DB\uC9D1' },
  { value: 'cafe', label: '\uCE74\uD398' },
  { value: 'photo', label: '\uD3EC\uD1A0' },
  { value: 'rest', label: '\uD734\uC2DD' },
  { value: 'view', label: '\uC804\uB9DD' },
];

const STEP_LABELS = [
  '\uAE30\uBCF8 \uC815\uBCF4',
  '\uACBD\uB85C \uC0C1\uC138',
  '\uC6E8\uC774\uD3EC\uC778\uD2B8',
  '\uC0AC\uC9C4 & \uBBF8\uB9AC\uBCF4\uAE30',
];

const TOTAL_STEPS = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Waypoint {
  id: string;
  name: string;
  type: string;
  description: string;
  lat: number | null;
  lng: number | null;
}

interface Activity {
  id: number;
  title?: string;
  started_at?: string;
  distance_km?: number;
  track_points?: { lat: number; lng: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrailCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('KR');
  const [difficulty, setDifficulty] = useState('moderate');
  const [tags, setTags] = useState('');

  // Step 2 — Route & Details
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLng, setEndLng] = useState<number | null>(null);
  const [pathData, setPathData] = useState<[number, number][] | null>(null);

  // Activity import modal
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Step 3 — Waypoints
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // Step 4 — Photo & Preview
  const [coverImage, setCoverImage] = useState<{
    uri: string;
    type?: string;
    fileName?: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // GPS helpers
  // ---------------------------------------------------------------------------

  const grabCurrentGPS = useCallback(
    (onSuccess: (lat: number, lng: number) => void) => {
      Geolocation.getCurrentPosition(
        (pos) => onSuccess(pos.coords.latitude, pos.coords.longitude),
        () =>
          Alert.alert(
            '\uC704\uCE58 \uC624\uB958',
            '\uD604\uC7AC \uC704\uCE58\uB97C \uAC00\uC838\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4',
          ),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    },
    [],
  );

  const useCurrentLocationForStart = useCallback(() => {
    grabCurrentGPS((lat, lng) => {
      setStartLat(lat);
      setStartLng(lng);
      Alert.alert(
        '\uC644\uB8CC',
        `\uCD9C\uBC1C\uC810 \uC88C\uD45C: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      );
    });
  }, [grabCurrentGPS]);

  const useCurrentLocationForEnd = useCallback(() => {
    grabCurrentGPS((lat, lng) => {
      setEndLat(lat);
      setEndLng(lng);
      Alert.alert(
        '\uC644\uB8CC',
        `\uB3C4\uCC29\uC810 \uC88C\uD45C: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      );
    });
  }, [grabCurrentGPS]);

  // ---------------------------------------------------------------------------
  // Activity import
  // ---------------------------------------------------------------------------

  const openActivityModal = useCallback(async () => {
    setLoadingActivities(true);
    setActivityModalVisible(true);
    try {
      const res = await api.get('/activities/');
      const list: Activity[] = Array.isArray(res.data)
        ? res.data
        : res.data?.results ?? [];
      setActivities(list);
    } catch {
      Alert.alert(
        '\uC624\uB958',
        '\uD65C\uB3D9 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4',
      );
      setActivityModalVisible(false);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const importActivity = useCallback(
    (activity: Activity) => {
      setActivityModalVisible(false);
      const pts = activity.track_points;
      if (!pts || pts.length === 0) {
        Alert.alert(
          '\uC624\uB958',
          '\uC774 \uD65C\uB3D9\uC5D0\uB294 \uACBD\uB85C \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4',
        );
        return;
      }

      // Build path_data as [lng, lat] for GeoJSON
      const coords: [number, number][] = pts.map((p) => [p.lng, p.lat]);
      setPathData(coords);

      // Start / end from first / last point
      const first = pts[0];
      const last = pts[pts.length - 1];
      setStartLat(first.lat);
      setStartLng(first.lng);
      setEndLat(last.lat);
      setEndLng(last.lng);

      // Calculate total distance
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += haversineDistance(
          pts[i - 1].lat,
          pts[i - 1].lng,
          pts[i].lat,
          pts[i].lng,
        );
      }
      setDistanceKm(total.toFixed(2));

      if (activity.distance_km && activity.distance_km > 0) {
        setDistanceKm(activity.distance_km.toFixed(2));
      }

      Alert.alert(
        '\uAC00\uC838\uC624\uAE30 \uC644\uB8CC',
        `${pts.length}\uAC1C \uD2B8\uB799\uD3EC\uC778\uD2B8\uAC00 \uC801\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4`,
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Waypoints
  // ---------------------------------------------------------------------------

  const addWaypoint = useCallback(() => {
    setWaypoints((prev) => [
      ...prev,
      {
        id: generateId(),
        name: '',
        type: 'photo',
        description: '',
        lat: null,
        lng: null,
      },
    ]);
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWaypoint = useCallback(
    (id: string, field: keyof Waypoint, value: any) => {
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
      );
    },
    [],
  );

  const grabGPSForWaypoint = useCallback(
    (id: string) => {
      grabCurrentGPS((lat, lng) => {
        setWaypoints((prev) =>
          prev.map((w) => (w.id === id ? { ...w, lat, lng } : w)),
        );
        Alert.alert(
          '\uC644\uB8CC',
          `\uC88C\uD45C: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        );
      });
    },
    [grabCurrentGPS],
  );

  // ---------------------------------------------------------------------------
  // Image picker
  // ---------------------------------------------------------------------------

  const pickImage = useCallback((source: 'camera' | 'gallery') => {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
      maxWidth: 1200,
      maxHeight: 1200,
    };
    const fn = source === 'camera' ? launchCamera : launchImageLibrary;
    fn(options, (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setCoverImage({
          uri: asset.uri,
          type: asset.type,
          fileName: asset.fileName,
        });
      }
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canGoNext = useCallback(() => {
    if (step === 1) {
      return title.trim().length > 0 && description.trim().length > 0;
    }
    if (step === 2) {
      return distanceKm.trim().length > 0 && estimatedMinutes.trim().length > 0;
    }
    return true;
  }, [step, title, description, distanceKm, estimatedMinutes]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Build JSON payload
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        region: region.trim() || undefined,
        country,
        difficulty,
        distance_km: parseFloat(distanceKm) || 0,
        estimated_minutes: parseInt(estimatedMinutes, 10) || 0,
        status: 'pending',
      };

      if (startLat != null && startLng != null) {
        payload.start_lat = startLat;
        payload.start_lng = startLng;
      }
      if (endLat != null && endLng != null) {
        payload.end_lat = endLat;
        payload.end_lng = endLng;
      }

      // path_data as GeoJSON LineString
      if (pathData && pathData.length > 1) {
        payload.path_data = {
          type: 'LineString',
          coordinates: pathData,
        };
      }

      // Tags — comma separated string -> array of tag names
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) {
        payload.tag_ids = tagList;
      }

      // 1) Create the trail with JSON
      const trailRes = await api.post('/trails/', payload);
      const trailId = trailRes.data?.id;

      // 2) If cover image, PATCH with FormData
      if (coverImage && trailId) {
        const formData = new FormData();
        formData.append('cover_image', {
          uri: coverImage.uri,
          type: coverImage.type || 'image/jpeg',
          name: coverImage.fileName || 'cover.jpg',
        } as any);

        await api.patch(`/trails/${trailId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3) Create waypoints (spots)
      if (trailId && waypoints.length > 0) {
        const validWaypoints = waypoints.filter((w) => w.name.trim());
        for (let i = 0; i < validWaypoints.length; i++) {
          const wp = validWaypoints[i];
          const spotPayload: Record<string, any> = {
            trail: trailId,
            name: wp.name.trim(),
            spot_type: wp.type,
            description: wp.description.trim() || undefined,
            order: i + 1,
          };
          if (wp.lat != null && wp.lng != null) {
            spotPayload.latitude = wp.lat;
            spotPayload.longitude = wp.lng;
          }
          try {
            await api.post('/spots/', spotPayload);
          } catch {
            // Continue even if a spot fails
          }
        }
      }

      Alert.alert(
        '\uC131\uACF5',
        '\uCF54\uC2A4\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4!',
        [{ text: '\uD655\uC778', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      const data = err?.response?.data;
      let msg = '\uCF54\uC2A4 \uB4F1\uB85D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4';
      if (data) {
        if (typeof data === 'string') {
          msg = data;
        } else if (data.detail) {
          msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else {
          // Show field errors
          const errors = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
          msg = errors || msg;
        }
      }
      Alert.alert('\uC624\uB958', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    title,
    description,
    region,
    country,
    difficulty,
    distanceKm,
    estimatedMinutes,
    startLat,
    startLng,
    endLat,
    endLng,
    pathData,
    tags,
    coverImage,
    waypoints,
    navigation,
  ]);

  // ---------------------------------------------------------------------------
  // Step Indicator
  // ---------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.stepItemWrap}>
          <View style={[styles.stepDot, s <= step && styles.stepDotActive]}>
            <Text
              style={[
                styles.stepDotText,
                s <= step && styles.stepDotTextActive,
              ]}>
              {s}
            </Text>
          </View>
          <Text style={[styles.stepLabel, s === step && styles.stepLabelActive]}>
            {STEP_LABELS[s - 1]}
          </Text>
        </View>
      ))}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 1 — Basic Info
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>
          {'\uCF54\uC2A4 \uC774\uB984'} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.textInput}
          placeholder="\uC608: \uBD81\uCD0C\uD55C\uC625\uB9C8\uC744 \uAC78\uAE30"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>
          {'\uC124\uBA85'} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="\uCF54\uC2A4\uC5D0 \uB300\uD55C \uC124\uBA85\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.fieldLabel}>{'\uC9C0\uC5ED'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="\uC608: \uC11C\uC6B8 \uC885\uB85C\uAD6C"
          placeholderTextColor={colors.textTertiary}
          value={region}
          onChangeText={setRegion}
        />

        <Text style={styles.fieldLabel}>{'\uD0DC\uADF8'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="\uC608: \uB9DB\uC9D1\uD22C\uC5B4, \uC5ED\uC0AC\uD0D0\uBC29 (\uC27C\uD45C\uB85C \uAD6C\uBD84)"
          placeholderTextColor={colors.textTertiary}
          value={tags}
          onChangeText={setTags}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{'\uAD6D\uAC00'}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}>
          <View style={styles.chipGroup}>
            {COUNTRY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.selectChip,
                  country === opt.value && styles.selectChipActive,
                ]}
                onPress={() => setCountry(opt.value)}>
                <Text
                  style={[
                    styles.selectChipText,
                    country === opt.value && styles.selectChipTextActive,
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.fieldLabel}>{'\uB09C\uC774\uB3C4'}</Text>
        <View style={styles.chipGroup}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.selectChip,
                difficulty === opt.value && styles.selectChipActive,
              ]}
              onPress={() => setDifficulty(opt.value)}>
              <Text
                style={[
                  styles.selectChipText,
                  difficulty === opt.value && styles.selectChipTextActive,
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 2 — Route & Details
  // ---------------------------------------------------------------------------

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{'\uCD9C\uBC1C\uC9C0'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="\uC608: \uACBD\uBCF5\uAD81\uC5ED 3\uBC88 \uCD9C\uAD6C"
          placeholderTextColor={colors.textTertiary}
          value={startLocation}
          onChangeText={setStartLocation}
        />

        <Text style={styles.fieldLabel}>{'\uB3C4\uCC29\uC9C0'}</Text>
        <TextInput
          style={styles.textInput}
          placeholder="\uC608: \uC548\uAD6D\uC5ED 1\uBC88 \uCD9C\uAD6C"
          placeholderTextColor={colors.textTertiary}
          value={endLocation}
          onChangeText={setEndLocation}
        />

        <View style={styles.rowBetween}>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>
              {'\uAC70\uB9AC (km)'}{' '}
              <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="3.5"
              placeholderTextColor={colors.textTertiary}
              value={distanceKm}
              onChangeText={setDistanceKm}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>
              {'\uC608\uC0C1 \uC2DC\uAC04 (\uBD84)'}{' '}
              <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="90"
              placeholderTextColor={colors.textTertiary}
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>GPS {'\uC88C\uD45C'}</Text>

        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsLabel}>
              {'\uCD9C\uBC1C\uC810'}:{' '}
              {startLat != null
                ? `${startLat.toFixed(5)}, ${startLng?.toFixed(5)}`
                : '\uBBF8\uC124\uC815'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gpsBtnSmall}
            onPress={useCurrentLocationForStart}>
            <Text style={styles.gpsBtnSmallText}>
              {'\uD604\uC7AC \uC704\uCE58'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsLabel}>
              {'\uB3C4\uCC29\uC810'}:{' '}
              {endLat != null
                ? `${endLat.toFixed(5)}, ${endLng?.toFixed(5)}`
                : '\uBBF8\uC124\uC815'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gpsBtnSmall}
            onPress={useCurrentLocationForEnd}>
            <Text style={styles.gpsBtnSmallText}>
              {'\uD604\uC7AC \uC704\uCE58'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.importBtn} onPress={openActivityModal}>
        <Text style={styles.importBtnIcon}>{'\uD83D\uDCE5'}</Text>
        <View>
          <Text style={styles.importBtnTitle}>
            {'\uD65C\uB3D9 \uAE30\uB85D\uC5D0\uC11C \uAC00\uC838\uC624\uAE30'}
          </Text>
          <Text style={styles.importBtnSub}>
            {'\uC800\uC7A5\uB41C \uC0B0\uCC45 \uAE30\uB85D\uC758 \uACBD\uB85C\uB97C \uC790\uB3D9 \uC785\uB825\uD569\uB2C8\uB2E4'}
          </Text>
        </View>
      </TouchableOpacity>

      {pathData && pathData.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {'\uACBD\uB85C \uBBF8\uB9AC\uBCF4\uAE30'} ({pathData.length}{' '}
            {'\uD3EC\uC778\uD2B8'})
          </Text>
          <SafeMapView
            lat={pathData[0][1]}
            lng={pathData[0][0]}
            endLat={pathData[pathData.length - 1][1]}
            endLng={pathData[pathData.length - 1][0]}
            pathCoordinates={pathData}
            region={region}
            country={country}
            height={180}
          />
        </View>
      )}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 3 — Waypoints
  // ---------------------------------------------------------------------------

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {'\uC6E8\uC774\uD3EC\uC778\uD2B8 (\uC2A4\uD31F)'}
        </Text>
        <Text style={styles.cardSubtitle}>
          {'\uACBD\uB85C \uC911 \uC8FC\uC694 \uC7A5\uC18C\uB97C \uCD94\uAC00\uD574\uBCF4\uC138\uC694'}
        </Text>

        {waypoints.map((wp, idx) => (
          <View key={wp.id} style={styles.waypointItem}>
            <View style={styles.waypointHeader}>
              <Text style={styles.waypointNumber}>{idx + 1}</Text>
              <TouchableOpacity
                style={styles.waypointRemoveBtn}
                onPress={() => removeWaypoint(wp.id)}>
                <Text style={styles.waypointRemoveText}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder={'\uC7A5\uC18C \uC774\uB984'}
              placeholderTextColor={colors.textTertiary}
              value={wp.name}
              onChangeText={(v) => updateWaypoint(wp.id, 'name', v)}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8 }}>
              <View style={styles.chipGroup}>
                {WAYPOINT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.selectChipSmall,
                      wp.type === t.value && styles.selectChipActive,
                    ]}
                    onPress={() => updateWaypoint(wp.id, 'type', t.value)}>
                    <Text
                      style={[
                        styles.selectChipTextSmall,
                        wp.type === t.value && styles.selectChipTextActive,
                      ]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder={'\uC124\uBA85 (\uC120\uD0DD)'}
              placeholderTextColor={colors.textTertiary}
              value={wp.description}
              onChangeText={(v) => updateWaypoint(wp.id, 'description', v)}
            />

            <View style={styles.waypointGpsRow}>
              <Text style={styles.gpsLabel}>
                {wp.lat != null
                  ? `${wp.lat.toFixed(5)}, ${wp.lng?.toFixed(5)}`
                  : '\uC88C\uD45C \uBBF8\uC124\uC815'}
              </Text>
              <TouchableOpacity
                style={styles.gpsBtnTiny}
                onPress={() => grabGPSForWaypoint(wp.id)}>
                <Text style={styles.gpsBtnTinyText}>GPS</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addWaypointBtn} onPress={addWaypoint}>
          <Text style={styles.addWaypointText}>
            + {'\uC6E8\uC774\uD3EC\uC778\uD2B8 \uCD94\uAC00'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 4 — Photo & Preview
  // ---------------------------------------------------------------------------

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>{'\uCEE4\uBC84 \uC0AC\uC9C4'}</Text>
        {coverImage ? (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: coverImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setCoverImage(null)}>
              <Text style={styles.removeImageText}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={styles.imagePickBtn}
              onPress={() => pickImage('camera')}>
              <Text style={styles.imagePickIcon}>{'\uD83D\uDCF7'}</Text>
              <Text style={styles.imagePickLabel}>{'\uCE74\uBA54\uB77C'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.imagePickBtn}
              onPress={() => pickImage('gallery')}>
              <Text style={styles.imagePickIcon}>{'\uD83D\uDDBC'}</Text>
              <Text style={styles.imagePickLabel}>{'\uAC24\uB7EC\uB9AC'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Map preview */}
      {startLat != null && startLng != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {'\uACBD\uB85C \uBBF8\uB9AC\uBCF4\uAE30'}
          </Text>
          <SafeMapView
            lat={startLat}
            lng={startLng}
            endLat={endLat ?? undefined}
            endLng={endLng ?? undefined}
            pathCoordinates={pathData ?? undefined}
            region={region}
            country={country}
            height={200}
          />
        </View>
      )}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          {'\uCF54\uC2A4 \uC694\uC57D'}
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'\uC81C\uBAA9'}</Text>
          <Text style={styles.summaryValue}>{title || '-'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'\uC9C0\uC5ED'}</Text>
          <Text style={styles.summaryValue}>
            {region || '-'}
            {' \u00B7 '}
            {COUNTRY_OPTIONS.find((c) => c.value === country)?.label || country}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'\uB09C\uC774\uB3C4'}</Text>
          <Text style={styles.summaryValue}>
            {DIFFICULTY_OPTIONS.find((d) => d.value === difficulty)?.label ||
              difficulty}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'\uAC70\uB9AC / \uC2DC\uAC04'}</Text>
          <Text style={styles.summaryValue}>
            {distanceKm || '-'} km {' \u00B7 '} {estimatedMinutes || '-'}{' '}
            {'\uBD84'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{'\uACBD\uB85C'}</Text>
          <Text style={styles.summaryValue}>
            {pathData
              ? `${pathData.length}\uAC1C \uD3EC\uC778\uD2B8`
              : '\uBBF8\uC124\uC815'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {'\uC6E8\uC774\uD3EC\uC778\uD2B8'}
          </Text>
          <Text style={styles.summaryValue}>
            {waypoints.filter((w) => w.name.trim()).length}
            {'\uAC1C'}
          </Text>
        </View>
        {tags.trim() ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{'\uD0DC\uADF8'}</Text>
            <Text style={styles.summaryValue}>{tags}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Activity Import Modal
  // ---------------------------------------------------------------------------

  const renderActivityModal = () => (
    <Modal
      visible={activityModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setActivityModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 },
          ]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {'\uD65C\uB3D9 \uAE30\uB85D \uC120\uD0DD'}
            </Text>
            <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
              <Text style={styles.modalClose}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          {loadingActivities ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.modalLoading}>
              <Text style={styles.modalEmptyText}>
                {'\uD65C\uB3D9 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.activityItem}
                  onPress={() => importActivity(item)}>
                  <View>
                    <Text style={styles.activityTitle}>
                      {item.title || `\uD65C\uB3D9 #${item.id}`}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {item.started_at
                        ? new Date(item.started_at).toLocaleDateString()
                        : ''}
                      {item.distance_km
                        ? ` \u00B7 ${item.distance_km.toFixed(1)}km`
                        : ''}
                      {item.track_points
                        ? ` \u00B7 ${item.track_points.length}\uD3EC\uC778\uD2B8`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.activityArrow}>{'\u203A'}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backText}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'\uCF54\uC2A4 \uB4F1\uB85D'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      {/* Bottom nav buttons */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 },
        ]}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.prevBtn}
            onPress={() => setStep(step - 1)}>
            <Text style={styles.prevBtnText}>{'\uC774\uC804'}</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canGoNext() && styles.btnDisabled]}
            onPress={() => {
              if (canGoNext()) setStep(step + 1);
            }}
            disabled={!canGoNext()}>
            <Text style={styles.nextBtnText}>{'\uB2E4\uC74C'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {'\uB4F1\uB85D\uD558\uAE30'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {renderActivityModal()}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  stepItemWrap: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderDefault,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Content
  scrollBody: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: -8,
    marginBottom: 12,
  },

  // Fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Chips
  chipScroll: {
    marginBottom: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  selectChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  selectChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectChipTextSmall: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectChipTextActive: {
    color: '#FFFFFF',
  },

  // Row layouts
  rowBetween: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },

  // GPS
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  gpsLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  gpsBtnSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  gpsBtnSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gpsBtnTiny: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  gpsBtnTinyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Import
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed' as any,
  },
  importBtnIcon: {
    fontSize: 24,
  },
  importBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  importBtnSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Waypoints
  waypointItem: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  waypointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waypointNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.accentLight,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  waypointRemoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointRemoveText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  waypointGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addWaypointBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderStyle: 'dashed' as any,
    alignItems: 'center',
    marginTop: 4,
  },
  addWaypointText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Image
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  imagePickBtn: {
    flex: 1,
    height: 120,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 16,
    borderStyle: 'dashed' as any,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickIcon: {
    fontSize: 28,
  },
  imagePickLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  previewWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Summary
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  prevBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 18,
    color: colors.textTertiary,
    padding: 4,
  },
  modalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityMeta: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  activityArrow: {
    fontSize: 22,
    color: colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: 20,
  },
});
