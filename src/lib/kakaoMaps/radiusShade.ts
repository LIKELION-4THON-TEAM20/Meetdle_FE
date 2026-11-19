import subtract from '../../assets/place-exploration/radius-subtract.svg';

// Fixed Figma overlay: only the map container size affects the cutout.
export function createRadiusShade(node: HTMLElement) {
  const shade = node.ownerDocument.createElement('div');
  shade.className = 'exploration-map__shade';
  shade.setAttribute('aria-hidden', 'true');
  const tile = node.ownerDocument.createElement('div');
  tile.className = 'exploration-map__shade-tile';
  const image = node.ownerDocument.createElement('img');
  image.src = subtract;
  image.alt = '';
  image.width = 335;
  image.height = 430;
  image.draggable = false;
  tile.append(image);
  shade.append(tile);
  node.parentElement!.append(shade);
  const update = () => {
    const scale = Math.max(0.00001, node.clientWidth / 335);
    const extent = (Math.max(node.clientWidth, node.clientHeight) * 3) / scale;
    tile.style.left = '0px';
    tile.style.top = `${(node.clientHeight - 430 * scale) / 2}px`;
    tile.style.transform = `scale(${scale})`;
    tile.style.boxShadow = `0 0 0 ${extent}px rgb(238 238 240 / 75%)`;
  };
  update();
  return { update, dispose: () => shade.remove() };
}
