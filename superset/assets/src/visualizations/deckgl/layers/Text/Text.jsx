/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { TextLayer } from 'deck.gl';
import { flow, countBy, entries, partialRight, maxBy, head, last, filter } from 'lodash';
import Supercluster from 'supercluster';
import { CategoricalColorNamespace } from '@superset-ui/color';
import { hexToRGB } from 'src/modules/colors';

import { commonLayerProps } from '../common';
import { createDeckGLComponent } from '../../factory';

const { getScale } = CategoricalColorNamespace;
const DEFAULT_SIZE = 40;

export function getClusterName(name) {
  return name !== null
    ? flow(
      countBy,
      entries,
      partialRight(maxBy, last),
      head,
    )(name.split(','))
    : null;
}

function getPoints(data) {
  return data.map(d => d.coordinates);
}

function setTooltipContent() {
  // return o => (
  //   <div className="deckgl-tooltip">
  //     <TooltipRow label={`${t('Longitude, Latitude)')}: `}
  //         value={`${o.object.sourcePosition[0]}, ${o.object.sourcePosition[1]}`} />
  //     {
  //         formData.dimension && <TooltipRow label={`${formData.dimension}: `}
  //         value={`${o.object.cat_color}`} />
  //     }
  //   </div>
  // );
}

function getText(d) {
  if (d.properties && d.properties.cluster) {
    return getClusterName(d.properties.name) + `(${d.properties.point_count_abbreviated})`;
  }
  const name = d.properties ? d.properties.name : d.name;
  const values = name !== null ? name.split(',') : [null];
  const numItems = values.length;
  const result = `${values[0]}`;
  return numItems > 1 ? result + `(+${numItems - 1})` : result;
}

function getSize(d) {
  if (d.properties && d.properties.cluster) {
    return Math.floor(d.properties.point_count / 1000) * 20 + DEFAULT_SIZE;
  }

  return DEFAULT_SIZE;
}

function getColor(d, fd) {
  const cp = fd.color_picker;
  if (fd.grade_colors) {
    const colorFn = getScale(fd.color_scheme);
    return hexToRGB(colorFn(d.cat_color), cp.a * 255);
  }

  return [cp.r, cp.g, cp.b, cp.a * 255];
}

function getPosition(d) {
  return d.coordinates || d.geometry.coordinates;
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

export function getLayer(fd, payload, onAddFilter, setTooltip) {
  return new TextLayer({
    id: `text-layer-${fd.slice_id}`,
    data: payload.data.features,
    getPosition,
    getText,
    getSize,
    getAngle: 0,
    getColor: d => getColor(d, fd),
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'bottom',
    ...commonLayerProps(fd, setTooltip, setTooltipContent(fd)),
  });
}

export default createDeckGLComponent(getLayer, getPoints);
