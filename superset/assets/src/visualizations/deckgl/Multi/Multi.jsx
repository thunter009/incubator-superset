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
import React from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { SupersetClient } from '@superset-ui/connection';
import Legend from 'src/visualizations/Legend';

import DeckGLContainer from '../DeckGLContainer';
import { getExploreLongUrl } from '../../../explore/exploreUtils';
import layerGenerators from '../layers';
import { hexToRGB } from 'src/modules/colors';
import { getScale } from '@superset-ui/color/lib/CategoricalColorNamespace';
import { getBuckets } from '../utils';
import sandboxedEval from 'src/modules/sandbox';

export const containerTypes = {
  default: 'Default',
  animatable: 'Animatable',
  categorical: 'Categorical',
};

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  setTooltip: PropTypes.func,
  onSelect: PropTypes.func,
};
const defaultProps = {
  onAddFilter() {},
  setTooltip() {},
  onSelect() {},
};

class DeckMulti extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      subSlices: {},
      subSlicesLayers: {},
      payloads: {},
    };
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  componentDidMount() {
    const { formData, payload } = this.props;
    this.loadLayers(formData, payload);
  }

  componentWillReceiveProps(nextProps) {
    const { formData, payload } = nextProps;
    const hasChanges = !_.isEqual(this.props.formData.deck_slices, nextProps.formData.deck_slices);
    if (hasChanges) {
      this.loadLayers(formData, payload);
    }
  }

  onViewportChange(viewport) {
    this.setState({ viewport });
  }

  onSelected(viewport, selectedItem) {
    this.setState({ viewport, selectedItem });
  }

  onHover({ x, y, object }) {
    this.setState({ x, y, hoveredObject: object });
  }

  getMainLayerFormData() {
    const { subSlices } = this.state;

    const mainLayerId = this.props.formData.container_main;
    return subSlices[mainLayerId] ? subSlices[mainLayerId].form_data : {};
  }

  getScatterCategories(formData, data) {
    const c = formData.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const fixedColor = [c.r, c.g, c.b, 255 * c.a];
    const colorFn = getScale(formData.color_scheme);
    const categories = {};
    data.forEach((d) => {
      if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
        let color;
        if (formData.dimension) {
          color = hexToRGB(colorFn(d.cat_color), c.a * 255);
        } else {
          color = fixedColor;
        }
        categories[d.cat_color] = { color, enabled: true };
      }
    });
    return categories;
  }
 
  getCategories() {
    const { payloads, subSlices } = this.state;
    const formData = this.getMainLayerFormData();

    const mainLayerId = this.props.formData.container_main;
    const payload = payloads[mainLayerId];
    if (payload) {
      let metricLabel;
      let accessor;

      switch (subSlices[mainLayerId].form_data.viz_type) {
        case 'deck_polygon':
          metricLabel = formData.metric ? formData.metric.label || formData.metric : null;
          accessor = d => d[metricLabel];
          return getBuckets(formData, payload.data.features, accessor);
        case 'deck_scatter':
          return this.getScatterCategories(formData, payload.data.features);
        default:
          return {};
      }
    }
    return {};
  }

  filterScatterPayload(formData, payload) {
    let features = payload.data.features
    ? [...payload.data.features]
    : [];

    // Add colors from categories or fixed color
    features = this.addColor(features, formData);

    // Apply user defined data mutator if defined
    if (formData.js_data_mutator) {
      const jsFnMutator = sandboxedEval(formData.js_data_mutator);
      features = jsFnMutator(features);
    }

    /*
    // Filter by time
    if (values[0] === values[1] || values[1] === this.end) {
      features = features.filter(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      features = features.filter(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }
    */

    // Show only categories selected in the legend
    const cats = this.state.categories;
    if (formData.dimension) {
      features = features.filter(d => cats[d.cat_color] && cats[d.cat_color].enabled);
    }

    return {
      ...payload,
      data: { ...payload.data, features },
    };
  }

  filterPayload(formData, payload) {
    if (formData.viz_type === 'deck_scatter') {
      return this.filterScatterPayload(formData, payload);
    }
    return payload;
  }

  loadLayers(formData, payload, viewport) {
    this.setState({ subSlices: {}, subSlicesLayers: {}, viewport });
    payload.data.slices.forEach((subslice) => {
      // Filters applied to multi_deck are passed down to underlying charts
      // note that dashboard contextual information (filter_immune_slices and such) aren't
      // taken into consideration here
      const filters = [
        ...(subslice.form_data.filters || []),
        ...(formData.filters || []),
        ...(formData.extra_filters || []),
      ];
      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          filters,
        },
      };

      SupersetClient.get({
          endpoint: getExploreLongUrl(subsliceCopy.form_data, 'json'),
        })
        .then(({ json }) => {
          const layer = layerGenerators[subsliceCopy.form_data.viz_type](
            subsliceCopy.form_data,
            this.filterPayload(subsliceCopy.form_data, json),
            this.props.onAddFilter,
            this.props.setTooltip,
            [],
            this.props.onSelect,
          );
          this.setState({
            subSlicesLayers: {
              ...this.state.subSlicesLayers,
              [subsliceCopy.slice_id]: layer,
            },
            subSlices: {
              ...this.state.subSlices,
              [subsliceCopy.slice_id]: subsliceCopy,
            },
            payloads: {
              ...this.state.payloads,
              [subsliceCopy.slice_id]: json,
            },
          });
        })
        .catch(() => {});
    });
  }

  toggleCategory(category) {
    const categoryState = this.state.categories[category];
    const categories = {
      ...this.state.categories,
      [category]: {
        ...categoryState,
        enabled: !categoryState.enabled,
      },
    };

    // if all categories are disabled, enable all -- similar to nvd3
    if (Object.values(categories).every(v => !v.enabled)) {
      /* eslint-disable no-param-reassign */
      Object.values(categories).forEach((v) => { v.enabled = true; });
    }
    this.setState({ categories });
  }
  showSingleCategory(category) {

    const categories = { ...this.state.categories };
    /* eslint-disable no-param-reassign */
    Object.values(categories).forEach((v) => { v.enabled = false; });
    categories[category].enabled = true;
    this.setState({ categories });
  }

  renderContainer(layers) {
    const { payload, formData, setControlValue } = this.props;
    const viewport = this.state.viewport || this.props.viewport;

    return (
      <div style={{ position: 'relative' }}>
        <DeckGLContainer
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={viewport}
          onViewportChange={this.onViewportChange}
          layers={layers}
          mapStyle={formData.mapbox_style}
          setControlValue={setControlValue}
        />
        {formData.container_type === containerTypes.categorical &&
          <Legend
            categories={this.getCategories()}
            toggleCategory={this.toggleCategory}
            showSingleCategory={this.showSingleCategory}
            position={this.getMainLayerFormData().legend_position}
            format={this.getMainLayerFormData().legend_format}
          />
        }
      </div>
    );
  }

  render() {
    const { subSlicesLayers } = this.state;

    const layers = Object.values(subSlicesLayers);

    return (
      <DeckGLContainer
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={this.state.viewport || this.props.viewport}
        onViewportChange={this.onViewportChange}
        layers={layers}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
      />
    );
  }
}

DeckMulti.propTypes = propTypes;
DeckMulti.defaultProps = defaultProps;

export default DeckMulti;
