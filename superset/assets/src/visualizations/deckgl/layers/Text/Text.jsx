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
import React from 'react';
import { t } from '@superset-ui/translation';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';

function getPoints(data) {
    return data.map(d => d.coordinates);
}

function setTooltipContent(formData) {
    return o => (
      <div className="deckgl-tooltip">
        <TooltipRow label={`${t('Longitude, Latitude)')}: `} value={`${o.object.sourcePosition[0]}, ${o.object.sourcePosition[1]}`} />
        {
            formData.dimension && <TooltipRow label={`${formData.dimension}: `} value={`${o.object.cat_color}`} />
        }
      </div>
    );
}

// TODO: make this real layer component

export function getLayer(fd, payload, onAddFilter, setTooltip) {
    const data = payload.data.features;
    return new TextLayer({
        id: `text-layer-${fd.slice_id}`,
        data,
        getPosition: d => d.coordinates,
        getText: (d) => {
            const values = d.name.split(',');
            const numItems = values.length;
            const result = `${values[0]}`;
            return numItems > 1 ? result + `(+${numItems - 1})` : result;
        },
        getSize: d => d.name.split(',').length + 20,
        getAngle: 0,
        sizeUnits: 'meters',
        getColor: (d) => {
            let alpha = 255 * d.name.split(',').length / 60 + 50;
            if (alpha > 255) {
                alpha = 255;
            }
            return [255, 255, 255, alpha];
        },
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        ...commonLayerProps(fd, setTooltip, setTooltipContent(fd)),
    });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
