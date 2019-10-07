import { flow, countBy, entries, partialRight, maxBy, head, last, filter, isString, minBy } from 'lodash';
import * as fp from 'lodash/fp';
import Supercluster from 'supercluster';

const dummyCluster = {
  numPoints: 1,
}

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
    radius: 80,
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

function getClusterSizeByComparator(index, zoom, comparators) {
  const numPointsFieldName = 'numPoints';
  let cluster;
  if (zoom) {
    cluster = index.trees[zoom]
      ? comparators.lodash(index.trees[zoom].points, numPointsFieldName)
      : dummyCluster;
  } else {
    cluster = fp.flow([
      fp.map(indexLevel => comparators.lodash(indexLevel.points, numPointsFieldName)),
      comparators.fp('numPoints'),
    ])(index.trees);
  }
  return cluster.numPoints;
}

export function getMinClusterSize(index, zoom = null) {
  const comparators = {
    lodash: minBy,
    fp: fp.minBy,
  }
  return getClusterSizeByComparator(index, zoom, comparators);
}

export function getMaxClusterSize(index, zoom = null) {
  const comparators = {
    lodash: maxBy,
    fp: fp.maxBy,
  }
  return getClusterSizeByComparator(index, zoom, comparators);
}
