import restaurant from '../../assets/place-exploration/restaurant.png';
import restaurantSelected from '../../assets/place-exploration/restaurant-selected.png';
import cafe from '../../assets/place-exploration/cafe.png';
import pub from '../../assets/place-exploration/pub.png';
import culture from '../../assets/place-exploration/culture.png';
import type { ExplorationArea, RecommendedPlace } from '../../pages/PlaceExploration/types';
import type { Cluster, KakaoMaps } from './types';

const PIN_IMAGES = { restaurant, cafe, pub, culture };

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
    strokeWeight: 2,
    strokeColor: '#7c5cff',
    strokeOpacity: 0.8,
    fillColor: '#b9a8ff',
    fillOpacity: 0.12,
  });
  circle.setMap(map);
  const zoom = new maps.ZoomControl();
  map.addControl(zoom, maps.ControlPosition.RIGHT);
  const clusterer = new maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 7,
    disableClickZoom: true,
  });
  const onCluster = (cluster: Cluster) => map.setBounds(cluster.getBounds(), 32, 32, 32, 32);
  maps.event.addListener(clusterer, 'clusterclick', onCluster);
  const fit = () => map.setBounds(circle.getBounds(), 36, 36, 36, 36);
  fit();
  let previousPlaces: readonly RecommendedPlace[] | null = null;
  let markers: {
    id: string;
    marker: InstanceType<KakaoMaps['Marker']>;
    normal: object;
    selected: object;
    click: () => void;
  }[] = [];
  const clearMarkers = () => {
    clusterer.clear();
    for (const { marker, click } of markers) {
      maps.event.removeListener(marker, 'click', click);
      marker.setMap(null);
    }
    markers = [];
  };
  return {
    fit,
    update(places: readonly RecommendedPlace[], selectedId: string | null) {
      if (places !== previousPlaces) {
        clearMarkers();
        previousPlaces = places;
        markers = places.map((place) => {
          const normal = new maps.MarkerImage(PIN_IMAGES[place.categoryId], new maps.Size(20, 32), {
            offset: new maps.Point(10, 32),
          });
          const selected = new maps.MarkerImage(
            place.categoryId === 'restaurant' ? restaurantSelected : PIN_IMAGES[place.categoryId],
            new maps.Size(28, 45),
            { offset: new maps.Point(14, 45) },
          );
          const marker = new maps.Marker({
            position: new maps.LatLng(place.coordinates.latitude, place.coordinates.longitude),
            image: normal,
            title: place.name,
            clickable: true,
          });
          const click = () => onSelect(place.id);
          maps.event.addListener(marker, 'click', click);
          return { id: place.id, marker, normal, selected, click };
        });
        clusterer.addMarkers(markers.map(({ marker }) => marker));
      }
      for (const entry of markers) {
        entry.marker.setImage(entry.id === selectedId ? entry.selected : entry.normal);
        entry.marker.setZIndex(entry.id === selectedId ? 10 : 1);
      }
    },
    resize() {
      const currentCenter = map.getCenter();
      map.relayout();
      map.setCenter(currentCenter);
    },
    dispose() {
      clearMarkers();
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
