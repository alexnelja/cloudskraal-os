const CATEGORIES = {
  pin: [
    'pump', 'motor', 'borehole', 'tank', 'valve',
    'electrical_box', 'solar_panel', 'trough', 'feed_station',
    'gate', 'shed', 'silo', 'tractor', 'implement', 'beacon', 'generic',
  ],
  line: [
    'pipe', 'cable', 'powerline', 'fence', 'road',
    'path', 'irrigation_line', 'generic',
  ],
  polygon: [
    'dam', 'kraal', 'paddock', 'yard', 'orchard_block',
    'crop_block', 'alien_veg_patch', 'shed_area', 'generic',
  ],
};

function isValidCategory(type, category) {
  if (category == null) return true;
  const list = CATEGORIES[type];
  if (!list) return false;
  return list.includes(category);
}

module.exports = { CATEGORIES, isValidCategory };
