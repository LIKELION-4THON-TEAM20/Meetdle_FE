import restaurant from '../../assets/place-exploration/restaurant-default.svg';
import restaurantRegistered from '../../assets/place-exploration/restaurant-registered.svg';
import cafe from '../../assets/place-exploration/cafe-default.svg';
import cafeRegistered from '../../assets/place-exploration/cafe-registered.svg';
import pub from '../../assets/place-exploration/pub-default.svg';
import pubRegistered from '../../assets/place-exploration/pub-registered.svg';
import culture from '../../assets/place-exploration/culture-default.svg';
import cultureRegistered from '../../assets/place-exploration/culture-registered.svg';
import type { ExplorationArea, RecommendedPlace } from '../../pages/PlaceExploration/types';
import type { Cluster, KakaoMaps } from './types';
import { createRadiusShade } from './radiusShade';
import { createMarkerMotion } from './markerMotion';

const PIN_IMAGES = { restaurant, cafe, pub, culture };
const REGISTERED_IMAGES = {
  restaurant: restaurantRegistered,
  cafe: cafeRegistered,
  pub: pubRegistered,
  culture: cultureRegistered,
};

export function createPlaceMap(
  maps: KakaoMaps,
  node: HTMLElement,
  area: ExplorationArea,
  onSelect: (id: string) => void,
) {
  const center = new maps.LatLng(area.center.latitude, area.center.longitude);
  const map = new maps.Map(node, {
    center,
    level: 6,
    draggable: true,
    scrollwheel: true,
    keyboardShortcuts: true,
  });
  const circle = new maps.Circle({
    center,
    radius: area.radiusMeters,
    strokeWeight: 0,
    strokeColor: '#7c5cff',
    strokeOpacity: 0,
    fillColor: '#b9a8ff',
    fillOpacity: 0,
  });
  circle.setMap(map);
  const shade = createRadiusShade(node);
  const zoom = new maps.ZoomControl();
  map.addControl(zoom, maps.ControlPosition.RIGHT);
  const clusterer = new maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 10,
    disableClickZoom: true,
  });
  const onCluster = (cluster: Cluster) => map.setBounds(cluster.getBounds(), 32, 32, 32, 32);
  maps.event.addListener(clusterer, 'clusterclick', onCluster);
  const fit = () => {
    const bounds = circle.getBounds();
    map.setBounds(bounds, 12, 12, 12, 12);
    const projection = map.getProjection();
    const west = projection.containerPointFromCoords(bounds.getSouthWest());
    const east = projection.containerPointFromCoords(bounds.getNorthEast());
    // SDK zoom levels are discrete: the next wider level can leave the circle half-sized.
    if (Math.abs(east.x - west.x) < node.clientWidth * 0.8) {
      map.setLevel(Math.max(1, map.getLevel() - 1));
    }
  };
  fit();
  let previousPlaces: readonly RecommendedPlace[] | null = null;
  let markers: {
    id: string;
    marker: InstanceType<KakaoMaps['Marker']>;
    motion: ReturnType<typeof createMarkerMotion>;
    click: () => void;
  }[] = [];
  const clearMarkers = () => {
    clusterer.clear();
    for (const { marker, click, motion } of markers) {
      motion.dispose();
      maps.event.removeListener(marker, 'click', click);
      marker.setMap(null);
    }
    markers = [];
  };
  return {
    fit,
    update(
      places: readonly RecommendedPlace[],
      selectedId: string | null,
      registeredIds: readonly string[] = [],
    ) {
      if (places !== previousPlaces) {
        clearMarkers();
        previousPlaces = places;
        markers = places.map((place) => {
          const normal = new maps.MarkerImage(
            PIN_IMAGES[place.categoryId],
            new maps.Size(20, 31.396),
            {
              offset: new maps.Point(10, 31.396),
            },
          );
          const marker = new maps.Marker({
            position: new maps.LatLng(place.coordinates.latitude, place.coordinates.longitude),
            image: normal,
            title: place.name,
            clickable: true,
          });
          const click = () => onSelect(place.id);
          maps.event.addListener(marker, 'click', click);
          const motion = createMarkerMotion(
            maps,
            marker,
            PIN_IMAGES[place.categoryId],
            REGISTERED_IMAGES[place.categoryId],
          );
          return { id: place.id, marker, motion, click };
        });
        clusterer.addMarkers(markers.map(({ marker }) => marker));
      }
      for (const entry of markers) {
        const isSelected = entry.id === selectedId;
        const isRegistered = registeredIds.includes(entry.id);
        entry.motion.update(isSelected, isRegistered);
        entry.marker.setZIndex(isSelected ? 10 : isRegistered ? 5 : 1);
      }
    },
    resize() {
      const currentCenter = map.getCenter();
      map.relayout();
      map.setCenter(currentCenter);
      shade.update();
    },
    dispose() {
      clearMarkers();
      shade.dispose();
      maps.event.removeListener(clusterer, 'clusterclick', onCluster);
      circle.setMap(null);
      map.removeControl(zoom);
      map.setDraggable(false);
      map.setZoomable(false);
      map.setKeyboardShortcuts(false);
      node.replaceChildren();
    },
  };
}
