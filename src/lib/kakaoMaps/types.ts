// Kakao Maps Web SDK 사용 범위의 최소 타입. 공식 SDK 전역 객체를 감싼다.
export interface LatLng {
  getLat(): number;
  getLng(): number;
}
export interface Bounds {
  getSouthWest(): LatLng;
  getNorthEast(): LatLng;
}
export interface MapInstance {
  getProjection(): { containerPointFromCoords(coords: LatLng): { x: number; y: number } };
  setBounds(bounds: Bounds, top?: number, right?: number, bottom?: number, left?: number): void;
  getCenter(): LatLng;
  setCenter(center: LatLng): void;
  getLevel(): number;
  setLevel(level: number): void;
  relayout(): void;
  addControl(control: object, position: unknown): void;
  removeControl(control: object): void;
  setDraggable(enabled: boolean): void;
  setZoomable(enabled: boolean): void;
  setKeyboardShortcuts(enabled: boolean): void;
}
export interface Circle {
  setMap(map: MapInstance | null): void;
  getBounds(): Bounds;
}
export interface Marker {
  setMap(map: MapInstance | null): void;
  setImage(image: object): void;
  setZIndex(index: number): void;
}
export interface Clusterer {
  addMarkers(markers: Marker[]): void;
  clear(): void;
}
export interface Cluster {
  getBounds(): Bounds;
}
export interface KakaoMaps {
  load(callback: () => void): void;
  Map: new (
    node: HTMLElement,
    options: {
      center: LatLng;
      level: number;
      draggable: boolean;
      scrollwheel: boolean;
      keyboardShortcuts: boolean;
    },
  ) => MapInstance;
  LatLng: new (latitude: number, longitude: number) => LatLng;
  Circle: new (options: {
    center: LatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => Circle;
  Marker: new (options: {
    position: LatLng;
    image: object;
    title: string;
    clickable: boolean;
  }) => Marker;
  MarkerImage: new (url: string, size: object, options?: { offset: object }) => object;
  Size: new (width: number, height: number) => object;
  Point: new (x: number, y: number) => object;
  ZoomControl: new () => object;
  ControlPosition: { RIGHT: unknown };
  MarkerClusterer: new (options: {
    map: MapInstance;
    averageCenter: boolean;
    minLevel: number;
    disableClickZoom: boolean;
  }) => Clusterer;
  event: {
    addListener(target: object, event: string, handler: (...args: never[]) => void): void;
    removeListener(target: object, event: string, handler: (...args: never[]) => void): void;
  };
}

declare global {
  interface Window {
    kakao?: { maps?: Partial<KakaoMaps> };
  }
}
