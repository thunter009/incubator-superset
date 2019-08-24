import { flow, countBy, entries, partialRight, maxBy, head, last, filter, isString } from 'lodash';
import * as fp from 'lodash/fp';
import Supercluster from 'supercluster';

export function getClusterName(name) {
  return isString(name)
    ? flow(
      countBy,
      entries,
      partialRight(maxBy, last),
      head,
    )(name.split(','))
    : name;
}

export function indexClusters(payload) {
  const clustersIndex = new Supercluster({
    maxZoom: 16,
    radius: 40,
    map: props => ({ name: props.name }),
    /* eslint no-param-reassign: ["error", { "props": false }] */
    reduce: (accumulated, props) => {
      accumulated.name = accumulated.name + ',' + props.name;
    },
  });
  let features = payload.data.features.map(d => ({
    geometry: { coordinates: d.coordinates },
    properties: d,
  }));

  features = filter(features, f => f.properties.name !== null);
  clustersIndex.load(features);
  return clustersIndex;
}

export function getMaxClusterSize(index) {
  const maxClusterSize = fp.flow([
    fp.map(indexLevel => maxBy(indexLevel.points, 'numPoints')),
    fp.maxBy('numPoints'),
  ])(index.trees);
  return maxClusterSize.numPoints;
}
