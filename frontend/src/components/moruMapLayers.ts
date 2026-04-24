/**
 * Mapbox 지도에 Komoot-수준 시각 효과를 얹는 헬퍼 모음.
 *
 * 핵심 설계:
 *  - 모든 함수는 **idempotent** — 같은 map 에 여러 번 호출해도 중복 레이어가 안 쌓임
 *  - DEM / contour / natural label 은 Mapbox 기본 타일셋을 그대로 사용 (Studio 커스텀 스타일
 *    불필요). 향후 NEXT_PUBLIC_MAPBOX_STYLE_URL 로 커스텀 스타일이 주어져도 위에 올려짐
 *  - 타일 요청 비용 관리를 위해 source 에 maxzoom 을 명시 (무한 로드 방지)
 *  - 트레일 라인은 outline → glow → main → arrow 순의 4 layer stack 으로, 진행 방향
 *    화살표를 symbol layer 로 얹어 Komoot 느낌을 냄
 *
 * 주의: 여기서는 `mapbox-gl` 모듈을 직접 import 하지 않는다. 호출 측 (MapView)에서
 * 동적 import 하여 `map` 인스턴스를 넘겨주면, 이 파일은 SSR 영향 없음.
 */

// 로케일별로 Mapbox 표준 필드명 매핑. Mapbox 는 'name_ko', 'name_en', 'name_ja', 'name_zh-Hans'
// 를 제공한다 (zh-Hans = 간체). 'name' 은 현지 공용 표기(한국 안에서는 한국어).
export type MoruMapLocale = 'ko' | 'en' | 'ja' | 'zh';

// 추가 레이어 ID 를 한 곳에 모음 → cleanup 시 일괄 제거
const MORU_LAYER_IDS = [
  'moru-hillshade',
  'moru-contour-major',
  'moru-contour-minor',
  'moru-trail-outline',
  'moru-trail-glow',
  'moru-trail-main',
  'moru-trail-arrows',
  'moru-trail-start',
  'moru-trail-end',
  'moru-sky',
  'moru-peaks',
  'moru-3d-buildings',
];
const MORU_SOURCE_IDS = [
  'moru-dem',
  'moru-terrain-vector',
  'moru-trail',
  'moru-trail-endpoints',
  'moru-peaks',
];

// 언어별 Mapbox name_* 필드 표현식. 여러 후보 필드를 coalesce 로 순회해서
// 누락된 경우에도 반드시 한글(또는 현지어)이 나오도록.
//
// OSM/Mapbox 는 같은 장소에도 name_ko / name_kr / name_ko-KR / name 등 표기가
// 섞여 있다. 이 중 하나라도 있으면 그대로, 아니면 최후의 'name'(현지어) 로 폴백.
function localeExpression(locale: MoruMapLocale): any[] {
  const fallbacks =
    locale === 'ko'
      ? ['name_ko', 'name_ko-KR', 'name_kr', 'name']
      : locale === 'zh'
        ? ['name_zh-Hans', 'name_zh-Hant', 'name_zh', 'name']
        : locale === 'ja'
          ? ['name_ja', 'name_ja-Latn', 'name']
          : ['name_en', 'name'];
  return ['coalesce', ...fallbacks.map((f) => ['get', f])];
}

// ────────────────────────────────────────────────────────────────
// 1. Hillshade + 3D Terrain + Contour
// ────────────────────────────────────────────────────────────────

export interface MoruBaseLayerOptions {
  /** 음영기복 on/off — 기본 true */
  hillshade?: boolean;
  /** 등고선 on/off — 기본 true (minzoom 11 이상에서만 타일 받음) */
  contours?: boolean;
  /** 3D pitch 지형. 모바일에선 성능 이슈로 기본 false 권장 */
  terrain3D?: boolean;
  /** 지형 과장 배율 (1 = 현실, 1.3 이 Komoot 느낌) */
  terrainExaggeration?: number;
  /** 'dark' | 'light' — contour 색 결정 */
  theme?: 'dark' | 'light';
}

/**
 * DEM 소스 1개 + hillshade layer + optional 3D terrain + contour layer 추가.
 * 반복 호출해도 안전 (source/layer 존재 체크).
 *
 * 레이어 순서는 "지형 → 도로/배경 → 라벨" 사이에 삽입되도록
 * beforeId 를 찾아 넣는다. dark-v11 기준 'road-label' 앞에 넣으면 라벨 위엔 안 그려짐.
 */
export function applyMoruBaseLayers(map: any, opts: MoruBaseLayerOptions = {}) {
  const {
    hillshade = true,
    contours = true,
    terrain3D = false,
    terrainExaggeration = 1.3,
    theme = 'dark',
  } = opts;

  if (!map || !map.isStyleLoaded()) return;

  // ── 1) DEM 소스 (hillshade + 3D terrain 공통 사용) ─────────────
  if (!map.getSource('moru-dem')) {
    map.addSource('moru-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      // 비용 관리: 너무 큰 줌에선 서버 DEM 이 어차피 의미 없음
      maxzoom: 14,
    });
  }

  // ── 2) Hillshade 레이어 ──────────────────────────────────────
  const roadLabelLayer = findLayerId(map, ['road-label', 'road-label-simple', 'road-label-navigation']);
  if (hillshade) {
    if (!map.getLayer('moru-hillshade')) {
      map.addLayer(
        {
          id: 'moru-hillshade',
          source: 'moru-dem',
          type: 'hillshade',
          paint: {
            // Komoot 느낌: 따뜻한 브라운 계열 음영, 부드러운 하이라이트
            'hillshade-shadow-color':
              theme === 'dark' ? '#000000' : '#6b5a3a',
            'hillshade-highlight-color':
              theme === 'dark' ? '#8da896' : '#f5efe0',
            'hillshade-accent-color':
              theme === 'dark' ? '#4b6a56' : '#8a7a50',
            'hillshade-exaggeration': theme === 'dark' ? 0.55 : 0.45,
            'hillshade-illumination-anchor': 'viewport',
            'hillshade-illumination-direction': 335,
          },
        },
        roadLabelLayer || undefined
      );
    }
  } else {
    if (map.getLayer('moru-hillshade')) map.removeLayer('moru-hillshade');
  }

  // ── 3) 3D Terrain — setTerrain 은 전역 상태 ───────────────────
  if (terrain3D) {
    map.setTerrain({ source: 'moru-dem', exaggeration: terrainExaggeration });
  } else {
    // null 로 해야 terrain 이 해제됨 (undefined 는 무시될 수 있음)
    map.setTerrain(null);
  }

  // ── 4) Contour (등고선) — vector tile ─────────────────────────
  if (!map.getSource('moru-terrain-vector')) {
    map.addSource('moru-terrain-vector', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2',
      maxzoom: 14,
    });
  }

  // Komoot 의 라이트 테마 등고선은 부드러운 브라운. 다크 테마에선 민트 그린.
  const contourColor = theme === 'dark' ? '#56D89B' : '#8a6a3a';
  if (contours) {
    if (!map.getLayer('moru-contour-minor')) {
      map.addLayer(
        {
          id: 'moru-contour-minor',
          type: 'line',
          source: 'moru-terrain-vector',
          'source-layer': 'contour',
          minzoom: 12,
          filter: ['!=', ['get', 'index'], 10],
          layout: {
            visibility: 'visible',
            'line-join': 'round',
          },
          paint: {
            'line-color': contourColor,
            'line-opacity': theme === 'dark' ? 0.18 : 0.25,
            'line-width': 0.6,
          },
        },
        roadLabelLayer || undefined
      );
    }
    if (!map.getLayer('moru-contour-major')) {
      map.addLayer(
        {
          id: 'moru-contour-major',
          type: 'line',
          source: 'moru-terrain-vector',
          'source-layer': 'contour',
          minzoom: 11,
          // index === 10 (주등고선) 만
          filter: ['==', ['get', 'index'], 10],
          layout: {
            visibility: 'visible',
            'line-join': 'round',
          },
          paint: {
            'line-color': contourColor,
            'line-opacity': theme === 'dark' ? 0.35 : 0.4,
            'line-width': 1.1,
          },
        },
        roadLabelLayer || undefined
      );
    }
  } else {
    if (map.getLayer('moru-contour-major')) map.removeLayer('moru-contour-major');
    if (map.getLayer('moru-contour-minor')) map.removeLayer('moru-contour-minor');
  }
}

// ────────────────────────────────────────────────────────────────
// 2. 로케일 라벨 전환
// ────────────────────────────────────────────────────────────────

/**
 * 현재 스타일의 모든 symbol 레이어의 text-field 를 해당 언어로 전환.
 *  - 한국어 설정이면 Seoul → "서울", Mt. Bukhan → "북한산" 식으로 강제
 *  - text-field 가 원래 없는(icon-only) 레이어는 건드리지 않음
 *  - isStyleLoaded 가 false 면 style.load 를 기다렸다 재시도
 */
export function applyMoruLabelLocale(map: any, locale: MoruMapLocale) {
  if (!map) return;
  if (!map.isStyleLoaded()) {
    try { map.once('style.load', () => applyMoruLabelLocale(map, locale)); } catch {}
    return;
  }
  const expr = localeExpression(locale);
  const layers: any[] = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    const id: string = layer.id ?? '';
    if (!id || id.startsWith('moru-')) continue;
    try {
      const existing = map.getLayoutProperty(id, 'text-field');
      // text-field 자체가 없는 icon-only 레이어는 스킵 (강제로 넣으면 깨짐)
      if (existing === undefined || existing === null) continue;
      map.setLayoutProperty(id, 'text-field', expr);
    } catch {
      /* 일부 스타일 layer 는 text-field 미지원 → 조용히 무시 */
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 3. 산봉우리 라벨 강조
// ────────────────────────────────────────────────────────────────

/**
 * dark-v11 의 natural-point-label (혹은 natural_label) 레이어의 산봉우리
 * 표기를 Komoot 느낌으로 강조:
 *  - icon 숨김, text 크기/halo 강화
 *  - 다크 테마에선 밝은 초록 halo, 라이트 테마에선 흰색 halo
 *  - 고도(ele) 필드가 있으면 이름 아래에 "172 m" 로 표시
 */
export function emphasizePeakLabels(map: any, theme: 'dark' | 'light' = 'dark') {
  if (!map || !map.isStyleLoaded()) return;

  // dark-v11 / streets-v12 모두 'natural-point-label' 을 사용.
  const candidates = ['natural-point-label', 'natural_label', 'poi-label'];
  let peakLayerId: string | null = null;
  for (const id of candidates) {
    if (map.getLayer(id)) {
      peakLayerId = id;
      break;
    }
  }
  if (!peakLayerId) return;

  try {
    // "peak", "volcano" 등 산 봉우리만 필터. 기존 filter 를 덮어쓰지 않고
    // visibility/크기만 조정 — 다른 자연물 라벨도 필요할 수 있으므로.
    map.setLayoutProperty(peakLayerId, 'visibility', 'visible');
    map.setLayoutProperty(peakLayerId, 'text-size', [
      'interpolate',
      ['linear'],
      ['zoom'],
      10,
      11,
      14,
      13,
      16,
      14,
    ]);

    // 고도 표시용 표현식 — name + 개행 + ele(정수 반올림) + "m"
    // 일부 봉우리는 ele 가 없으므로 coalesce 로 안전하게
    map.setLayoutProperty(peakLayerId, 'text-field', [
      'format',
      ['coalesce', ['get', 'name_ko'], ['get', 'name']],
      { 'font-scale': 1.0 },
      [
        'case',
        ['has', 'ele'],
        ['concat', '\n', ['to-string', ['round', ['get', 'ele']]], ' m'],
        '',
      ],
      { 'font-scale': 0.82, 'text-color': theme === 'dark' ? '#A8E6CF' : '#4b6a56' },
    ]);

    map.setPaintProperty(
      peakLayerId,
      'text-halo-color',
      theme === 'dark' ? 'rgba(10, 20, 14, 0.9)' : 'rgba(255,255,255,0.9)'
    );
    map.setPaintProperty(peakLayerId, 'text-halo-width', 1.4);
    map.setPaintProperty(
      peakLayerId,
      'text-color',
      theme === 'dark' ? '#E8F8EF' : '#191F28'
    );
  } catch {
    // 스타일에 따라 property 자체가 없을 수 있음 — 조용히 무시
  }
}

// ────────────────────────────────────────────────────────────────
// 4.5. 봉우리 고도 자동 표시 (DEM 샘플링)
// ────────────────────────────────────────────────────────────────

/**
 * 문제: Mapbox natural-point-label 의 mountain_peak 피처는 `ele` 가 있는 봉우리도
 * 있지만, 영종도 구봉산처럼 `ele` 가 비어있는 곳이 많다.
 *
 * 해결: DEM 소스를 상시 활성화(setTerrain, exaggeration 1)한 뒤 `queryTerrainElevation`
 * 으로 좌표별 고도를 런타임에 샘플링 → 별도의 symbol 소스(moru-peaks)에 "이름 + 고도 m"
 * 로 그린다. 원래의 natural-point-label 텍스트는 가려서 중복을 피함.
 *
 * idempotent — 호출마다 소스 내용만 갱신.
 * 비용: 뷰포트 기준 queryRenderedFeatures 1회 + 피처당 DEM 1샘플링. 무겁지 않음.
 */
export function addPeakElevationOverlay(
  map: any,
  theme: 'dark' | 'light' = 'light'
) {
  if (!map || !map.isStyleLoaded()) return;

  // 1) DEM 이 세팅되어 있지 않으면 고도 샘플링을 못하므로 exaggeration 1 로 켠다.
  //    pitch 가 0 일 땐 시각적 차이 없음.
  try {
    const curTerrain = map.getTerrain?.();
    if (!curTerrain) {
      map.setTerrain({ source: 'moru-dem', exaggeration: 1 });
    }
  } catch {
    /* DEM 소스 아직 없음 — 먼저 applyMoruBaseLayers 호출 필요 */
    return;
  }

  // 2) 현재 뷰포트의 natural_label / natural-point-label 피처 추출
  const layers: string[] = [];
  for (const id of ['natural-point-label', 'natural_label']) {
    if (map.getLayer(id)) layers.push(id);
  }
  if (layers.length === 0) return;

  let features: any[] = [];
  try {
    features = map.queryRenderedFeatures({ layers });
  } catch {
    return;
  }

  // 3) 봉우리(mountain) 타입만 + 좌표 중복 제거
  const peaks: Array<{
    id: string;
    lng: number;
    lat: number;
    name: string;
    ele: number | null;
  }> = [];
  const seen = new Set<string>();
  for (const f of features) {
    const cls = f.properties?.class || f.properties?.maki || '';
    // mountain_peak / volcano / peak 다양한 표기 처리
    if (!/peak|volcano|mountain/i.test(String(cls))) continue;
    const g = f.geometry;
    if (!g || g.type !== 'Point') continue;
    const [lng, lat] = g.coordinates as [number, number];
    const key = `${lng.toFixed(4)}|${lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name =
      f.properties?.name_ko ||
      f.properties?.name_kr ||
      f.properties?.name ||
      '';
    if (!name) continue;

    // DEM 샘플링 (없으면 null)
    let ele: number | null = null;
    try {
      const q = map.queryTerrainElevation([lng, lat], { exaggerated: false });
      if (typeof q === 'number' && isFinite(q)) ele = Math.round(q);
    } catch {
      ele = null;
    }

    // 원본 속성에 ele 가 있으면 우선
    if (f.properties?.ele != null) {
      const raw = Number(f.properties.ele);
      if (isFinite(raw)) ele = Math.round(raw);
    }

    peaks.push({ id: key, lng, lat, name, ele });
  }

  // 4) GeoJSON 갱신
  const fc = {
    type: 'FeatureCollection' as const,
    features: peaks.map((p) => ({
      type: 'Feature' as const,
      properties: {
        name: p.name,
        ele: p.ele,
        label: p.ele != null ? `${p.name}\n${p.ele} m` : p.name,
      },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    })),
  };

  if (map.getSource('moru-peaks')) {
    try {
      map.getSource('moru-peaks').setData(fc);
    } catch {
      /* noop */
    }
  } else {
    map.addSource('moru-peaks', { type: 'geojson', data: fc });
  }

  // 5) 기존 natural-point-label 텍스트 숨김 (중복 방지)
  //    완전 제거 대신 text 만 빈 문자열로 덮어써서 원 레이어 구조는 유지.
  for (const lid of layers) {
    try {
      map.setLayoutProperty(lid, 'text-field', '');
      map.setLayoutProperty(lid, 'icon-image', 'mountain-11');
    } catch {
      /* 지원 안 하는 스타일은 무시 */
    }
  }

  // 6) 봉우리 라벨 레이어 — Komoot 스타일 (이름 큰글씨 + 고도 작은 글씨)
  if (!map.getLayer('moru-peaks')) {
    map.addLayer({
      id: 'moru-peaks',
      type: 'symbol',
      source: 'moru-peaks',
      minzoom: 9,
      layout: {
        // 높은 봉우리 우선 표시
        'symbol-sort-key': [
          'case', ['has', 'ele'], ['-', 10000, ['get', 'ele']], 10000,
        ],
        // 이름 + (줄바꿈) 고도 m — 줌에 따라 고도 숨김/표시
        'text-field': [
          'format',
          ['get', 'name'], { 'font-scale': 1.0 },
          [
            'case',
            ['all', ['has', 'ele'], ['>=', ['zoom'], 10]],
            ['concat', '\n▲ ', ['to-string', ['get', 'ele']], ' m'],
            '',
          ],
          { 'font-scale': 0.75, 'text-color': theme === 'dark' ? '#A8E6CF' : '#7a5a28' },
        ],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          9, 11,
          12, 13,
          15, 15,
        ],
        'text-offset': [0, 0.9],
        'text-anchor': 'top',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-line-height': 1.15,
        'text-letter-spacing': 0.01,
        'text-allow-overlap': false,
        'text-optional': true,
        'text-padding': 6,
        'icon-image': 'mountain-11',
        'icon-size': 1.1,
        'icon-allow-overlap': true,
      },
      paint: {
        'text-color': theme === 'dark' ? '#F0FAF3' : '#1a1a1a',
        'text-halo-color':
          theme === 'dark' ? 'rgba(8,16,12,0.9)' : 'rgba(255,255,255,0.98)',
        'text-halo-width': 2.0,
        'text-halo-blur': 0.3,
      },
    });
  } else {
    try {
      map.setPaintProperty(
        'moru-peaks',
        'text-color',
        theme === 'dark' ? '#F0FAF3' : '#1a1a1a'
      );
      map.setPaintProperty(
        'moru-peaks',
        'text-halo-color',
        theme === 'dark' ? 'rgba(8,16,12,0.9)' : 'rgba(255,255,255,0.98)'
      );
    } catch {
      /* noop */
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 4. 트레일 라인 렌더 (Komoot 스타일 4-layer stack)
// ────────────────────────────────────────────────────────────────

export interface MoruTrailLineOptions {
  theme?: 'dark' | 'light';
  /** 진행 방향 화살표 표시 — 기본 true */
  showArrows?: boolean;
  /** 기본 '#A8E6CF' (dark) / '#2D4A2E' (light) */
  color?: string;
}

/**
 * 트레일 라인을 다음 순서로 그린다 (아래 → 위):
 *   1) outline   : 어두운 굵은 외곽선
 *   2) glow      : 반투명 넓은 빛
 *   3) main      : 밝은 중앙 라인
 *   4) arrows    : 화살표 symbol
 *
 * beforeId 로 road-label 앞에 삽입 → 지형 위, 도로 라벨 아래.
 */
export function drawMoruTrailLine(
  map: any,
  coords: [number, number][] | null | undefined,
  opts: MoruTrailLineOptions = {}
) {
  if (!map) return;

  // 먼저 기존 moru-trail 레이어/소스 제거 (업데이트)
  ['moru-trail-arrows', 'moru-trail-main', 'moru-trail-glow', 'moru-trail-outline']
    .forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource('moru-trail')) map.removeSource('moru-trail');

  if (!coords || coords.length < 2) return;

  const theme = opts.theme ?? 'dark';
  const color = opts.color ?? (theme === 'dark' ? '#A8E6CF' : '#2D4A2E');
  const showArrows = opts.showArrows ?? true;

  map.addSource('moru-trail', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
    // lineMetrics 는 line-gradient 와 상징 거리 계산에 필요
    lineMetrics: true,
  });

  const roadLabelLayer = findLayerId(map, ['road-label', 'road-label-simple', 'road-label-navigation']);

  // (1) outline — 라인의 '그림자' 역할. 지형 위에서 라인이 도드라져 보이게
  map.addLayer(
    {
      id: 'moru-trail-outline',
      type: 'line',
      source: 'moru-trail',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': theme === 'dark' ? '#0a1a10' : '#ffffff',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 4.5,
          14, 8,
          18, 11,
        ],
        'line-opacity': theme === 'dark' ? 0.85 : 0.9,
      },
    },
    roadLabelLayer || undefined
  );

  // (2) glow — 넓고 연한 아우라
  map.addLayer(
    {
      id: 'moru-trail-glow',
      type: 'line',
      source: 'moru-trail',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-blur': 4,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 6,
          14, 12,
          18, 16,
        ],
        'line-opacity': 0.28,
      },
    },
    roadLabelLayer || undefined
  );

  // (3) main — 실제 보이는 선
  map.addLayer(
    {
      id: 'moru-trail-main',
      type: 'line',
      source: 'moru-trail',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 2.2,
          14, 4,
          18, 6,
        ],
        'line-opacity': 0.95,
      },
    },
    roadLabelLayer || undefined
  );

  // (4) arrows — 진행 방향 symbol. 스프라이트 없는 환경에서도 안전하게
  //   "▶︎" 텍스트를 symbol 로 올림. line-center 로 일정 간격 반복 X →
  //   line-placement 로 라인을 따라 반복 배치.
  if (showArrows) {
    map.addLayer(
      {
        id: 'moru-trail-arrows',
        type: 'symbol',
        source: 'moru-trail',
        minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 140,
          'text-field': '▶',
          'text-size': 12,
          'text-keep-upright': false,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': theme === 'dark' ? '#0a1a10' : '#ffffff',
          'text-halo-color': color,
          'text-halo-width': 1.4,
        },
      },
      roadLabelLayer || undefined
    );
  }
}

// ────────────────────────────────────────────────────────────────
// 5. 정리 (스타일 변경 / unmount 시)
// ────────────────────────────────────────────────────────────────

/** 위에서 추가한 모든 layer/source 제거. setTerrain 도 초기화. */
export function cleanupMoruLayers(map: any) {
  if (!map) return;
  try { map.setTerrain(null); } catch {}
  for (const id of MORU_LAYER_IDS) {
    if (map.getLayer && map.getLayer(id)) {
      try { map.removeLayer(id); } catch {}
    }
  }
  for (const id of MORU_SOURCE_IDS) {
    if (map.getSource && map.getSource(id)) {
      try { map.removeSource(id); } catch {}
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────────

function findLayerId(map: any, candidates: string[]): string | null {
  for (const id of candidates) {
    if (map.getLayer && map.getLayer(id)) return id;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// 6. 라벨 가독성 강화 — 도로명, 동네, POI, 자연물
// ────────────────────────────────────────────────────────────────

/**
 * Mapbox dark-v11 기본 스타일은 라벨이 매우 보수적이라 도로명/동네/POI 가
 * 잘 안 보인다. 이 함수는 스타일 안의 모든 symbol 레이어를 순회하면서:
 *  - visibility: 'visible' 로 강제
 *  - text-halo 를 두껍게 (다크 배경에서 뚜렷하게)
 *  - text-color 를 테마에 맞춰 조정
 *  - 카테고리별로 text-size 를 살짝 올림 (줌별 interpolate)
 *  - symbol-sort-key / text-optional / icon-optional 을 안전하게 유지
 *
 * moru-* 레이어(우리가 추가한 것)는 건드리지 않는다.
 */
export function enhanceMapLabels(
  map: any,
  theme: 'dark' | 'light' = 'dark',
  options: { density?: 'default' | 'dense' } = {}
) {
  if (!map || !map.isStyleLoaded()) return;
  const density = options.density ?? 'dense';

  const haloColor =
    theme === 'dark' ? 'rgba(8, 16, 12, 0.85)' : 'rgba(255, 255, 255, 0.92)';
  const primaryText = theme === 'dark' ? '#F0FAF3' : '#191F28';
  const secondaryText = theme === 'dark' ? '#B7D3C0' : '#4b5563';

  const layers: any[] = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    const id: string = layer.id ?? '';
    if (!id || id.startsWith('moru-')) continue;

    // ── 공통: visibility, halo ────────────────────────────────
    trySet(map, id, 'layout', 'visibility', 'visible');
    trySet(map, id, 'paint', 'text-halo-color', haloColor);
    trySet(map, id, 'paint', 'text-halo-width', 1.6);
    trySet(map, id, 'paint', 'text-halo-blur', 0.4);

    // 카테고리별 크기 조정
    if (id.includes('road-label')) {
      // 도로명 — 공한신도시 내의 '해단북로' 같은 소로까지
      trySet(map, id, 'paint', 'text-color', primaryText);
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        10, 10,
        13, 11.5,
        15, 13,
        18, 15,
      ]);
    } else if (
      id.includes('settlement-subdivision') ||
      id.includes('neighbourhood') ||
      id.includes('neighborhood')
    ) {
      // 동·신도시·동네 (공한신도시, 역삼동 등)
      trySet(map, id, 'paint', 'text-color', primaryText);
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        11, 11,
        14, 13,
        17, 15,
      ]);
      trySet(map, id, 'paint', 'text-halo-width', 1.8);
    } else if (id.includes('settlement-minor') || id.includes('place-town')) {
      // 읍·면
      trySet(map, id, 'paint', 'text-color', primaryText);
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        8, 11, 12, 13, 15, 15,
      ]);
    } else if (id.includes('settlement-major') || id.includes('place-city')) {
      // 시·도
      trySet(map, id, 'paint', 'text-color', primaryText);
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        4, 11, 8, 14, 12, 18,
      ]);
    } else if (id.includes('poi-label')) {
      // 음식점, 카페, 관광지, 공원…
      trySet(map, id, 'paint', 'text-color', secondaryText);
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        13, 10,
        15, 11.5,
        18, 13,
      ]);
      if (density === 'dense') {
        // POI 는 기본적으로 overlap 우선순위가 낮아 많이 사라짐.
        // 밀도를 올리기 위해 icon 이 있는 경우도 text 표시 유지.
        trySet(map, id, 'layout', 'text-optional', true);
        trySet(map, id, 'layout', 'icon-optional', false);
      }
    } else if (id.includes('transit-label')) {
      // 역·정류장
      trySet(map, id, 'paint', 'text-color', primaryText);
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        12, 10, 15, 12, 18, 14,
      ]);
    } else if (id.includes('natural-line-label') || id.includes('waterway-label')) {
      // 하천·계곡
      trySet(map, id, 'paint', 'text-color', theme === 'dark' ? '#8FD6FF' : '#1E5FAA');
      trySet(map, id, 'layout', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        12, 10, 15, 12, 18, 14,
      ]);
    } else if (id.includes('water-point-label')) {
      trySet(map, id, 'paint', 'text-color', theme === 'dark' ? '#8FD6FF' : '#1E5FAA');
    } else if (id.includes('airport-label')) {
      trySet(map, id, 'paint', 'text-color', primaryText);
    } else if (id.includes('building-number-label')) {
      trySet(map, id, 'layout', 'visibility', 'visible');
      trySet(map, id, 'paint', 'text-color', secondaryText);
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 8. 3D Buildings (고해상도 줌에서 도심 디테일)
// ────────────────────────────────────────────────────────────────

/**
 * 줌 15+ 에서 건물 3D extrusion 추가.  Komoot 같은 지도앱이 도심에서 건물을
 * 입체적으로 보여주는 효과. outdoors-v12 / dark-v11 모두 'building' 소스
 * (composite tileset) 를 포함한다.
 */
export function apply3DBuildings(map: any, theme: 'dark' | 'light' = 'light') {
  if (!map || !map.isStyleLoaded()) return;
  if (map.getLayer('moru-3d-buildings')) return;

  // 'building' 소스-레이어가 composite 에 존재해야 함
  const sources = map.getStyle()?.sources ?? {};
  const hasComposite = Object.keys(sources).some((k) =>
    typeof sources[k]?.url === 'string' && sources[k].url.includes('mapbox-streets')
  ) || !!map.getSource('composite');

  if (!hasComposite) return;

  const labelLayer = findLayerId(map, ['road-label', 'settlement-minor-label']);

  try {
    map.addLayer(
      {
        id: 'moru-3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', ['get', 'extrude'], 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color':
            theme === 'dark' ? '#2a2f2e' : '#e9e4d6',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            16, ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            16, ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': theme === 'dark' ? 0.75 : 0.85,
        },
      },
      labelLayer || undefined
    );
  } catch {
    /* 일부 스타일(outdoors-v12)엔 building 소스-레이어가 'building' 외 다른 이름일 수 있음 */
  }
}

// 안전한 set — 스타일/레이어에 해당 property 가 없어도 throw 안 하도록
function trySet(
  map: any,
  layerId: string,
  kind: 'layout' | 'paint',
  prop: string,
  value: any
) {
  try {
    if (kind === 'layout') map.setLayoutProperty(layerId, prop, value);
    else map.setPaintProperty(layerId, prop, value);
  } catch {
    /* noop */
  }
}

// ────────────────────────────────────────────────────────────────
// 7. Sky + Fog (3D 모드에서 입체감)
// ────────────────────────────────────────────────────────────────

/**
 * 3D pitch 가 켜져 있을 때 지평선이 밋밋해 보이는 문제를 해결.
 * atmosphere sky 레이어 + fog 를 추가해 Komoot-스러운 원경 안개 효과.
 * idempotent — 반복 호출 안전.
 */
export function applyMoruAtmosphere(map: any, theme: 'dark' | 'light' = 'dark') {
  if (!map || !map.isStyleLoaded()) return;
  try {
    if (!map.getLayer('moru-sky')) {
      map.addLayer({
        id: 'moru-sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0, 0],
          'sky-atmosphere-sun-intensity': 5,
          'sky-atmosphere-color':
            theme === 'dark' ? 'rgb(18, 30, 36)' : 'rgb(180, 200, 220)',
        } as any,
      } as any);
    }
    map.setFog({
      color: theme === 'dark' ? 'rgb(14, 22, 18)' : 'rgb(230, 240, 235)',
      'high-color': theme === 'dark' ? 'rgb(28, 60, 46)' : 'rgb(200, 220, 210)',
      'horizon-blend': 0.08,
      'space-color': theme === 'dark' ? 'rgb(5, 10, 8)' : 'rgb(220, 234, 240)',
      'star-intensity': theme === 'dark' ? 0.4 : 0,
    } as any);
  } catch {
    /* 구형 Mapbox 에서 fog 미지원 — 무시 */
  }
}
