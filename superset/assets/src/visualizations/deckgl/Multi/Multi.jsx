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
/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */
import React from 'react';
import _ from 'lodash';
import Legend from 'src/visualizations/Legend';
import fp from 'lodash/fp';
import PropTypes from 'prop-types';
import { SupersetClient } from '@superset-ui/connection';
import sandboxedEval from 'src/modules/sandbox';
import { CategoricalColorNamespace } from '@superset-ui/color';
import { hexToRGB } from 'src/modules/colors';
import { getPlaySliderParams } from 'src/modules/time';

// import DeckGLContainer from '../DeckGLContainer';
import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';

import { getExploreLongUrl } from '../../../explore/exploreUtils';
import layerGenerators from '../layers';
import { getBuckets } from '../utils';

const { getScale } = CategoricalColorNamespace;

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
      payloads: {},
      categories: {},
    };
    this.getLayers = this.getLayers.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    this.onValuesChange = this.onValuesChange.bind(this);
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
    this.prepareData();
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

  onValuesChange(values) {
    this.setState({
      values: Array.isArray(values)
        ? values
        : [values, values + this.state.getStep(values)],
    });
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

  getLabel(subSlice) {
    const fd = subSlice.form_data;
    if (fd.dimension) {
      return fd.dimension;
    }
    return fd.metric ? fd.metric.label || fd.metric : null;
  }

  getLayers(values) {
      const { subSlices, payloads, selectedItem } = this.state;
      const layers = Object.keys(subSlices).map((key) => {
        const subSlice = subSlices[key];
        const payload = payloads[key];
        const filteredPayload = this.filterPayload(subSlice.form_data, payload, values);
        const vizType = subSlice.form_data.viz_type;
        return layerGenerators[vizType](
          subSlice.form_data,
          filteredPayload,
          this.props.onAddFilter,
          this.props.setTooltip,
          [],
          this.props.onSelect,
        );
    });

    if (selectedItem) {
      layers.push(this.generateNewMarkerLayer());
    }

    return layers;
  }

  prepareData() {
    this.setState({ categories: {} });
    const { subSlices, payloads } = this.state;

    Object.keys(subSlices).forEach((key) => {
      const subSlice = subSlices[key];
      const payload = payloads[key];
      const vizType = subSlice.form_data.viz_type;
      let categories;
      let metricLabel;
      let accessor;
      switch (vizType) {
        case 'deck_polygon':
          metricLabel = subSlice.form_data.metric ?
            subSlice.form_data.metric.label || subSlice.form_data.metric : null;
          accessor = d => d[metricLabel];
          categories = getBuckets(subSlice.form_data,
            payload.data.features, accessor);
          break;
        case 'deck_scatter':
          categories = this.getScatterCategories(subSlice.form_data,
            payload.data.features);
          break;
        default:
          categories = {};
      }

      this.setState({
        categories: {
          ...this.state.categories,
          [subSlice.slice_id]: categories,
        },
      });
    });

    const timestamps = fp.flow([
      fp.map(slicePayload => slicePayload.data.features || []),
      fp.flattenDeep,
      fp.map(f => f.__timestamp),
      fp.filter(timestamp => !!timestamp),
    ])(this.state.payloads);
    // the granularity has to be read from the payload form_data, not the
    // props formData which comes from the instantaneous controls state
    const granularity = (
      this.props.formData.time_grain_sqla ||
      this.props.formData.granularity ||
      'P1D'
    );

    const {
      start,
      end,
      getStep,
      values,
      disabled,
    } = getPlaySliderParams(timestamps, granularity);

    this.setState({
      start,
      end,
      getStep,
      values,
      disabled,
    });
  }

  showSingleCategory(category) {
    const categories = { ...this.state.categories };
    /* eslint-disable no-param-reassign */
    Object.values(categories).forEach((v) => { v.enabled = false; });
    categories[category].enabled = true;
    this.setState({ categories });
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

  generateNewMarkerLayer() {
    return new IconLayer({
      id: 'icon-layer',
      data: [this.state.selectedItem],
      pickable: true,
      iconAtlas: '/static/assets/images/location-pin.png',
      iconMapping: ICON_MAPPING,
      getIcon: () => 'marker',
      sizeScale: 15,
      getPosition: d => d.center,
      getSize: () => 5,
      getColor: () => [0, 166, 153],
      onHover: this.onHover.bind(this),
    });
  }

  removeMarker() {
    this.setState({
      selectedItem: null,
    });
  }

  filterPayload(formData, payload, values) {
    if (formData.viz_type === 'deck_scatter') {
      return this.filterScatterPayload(formData, payload, values);
    }
    return payload;
  }

  filterScatterPayload(formData, payload, values) {
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

    // Filter by time
    if (values[0] === values[1] || values[1] === this.end) {
      features = features.filter(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      features = features.filter(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    // Show only categories selected in the legend
    const cats = this.state.categories[formData.slice_id];
    if (cats && formData.dimension) {
      features = features.filter(d => cats[d.cat_color] && cats[d.cat_color].enabled);
    }

    return {
      ...payload,
      data: { ...payload.data, features },
    };
  }

  addColor(data, fd) {
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const colorFn = getScale(fd.color_scheme);
    return data.map((d) => {
      let color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color), c.a * 255);
        return { ...d, color };
      }
      return d;
    });
  }

  loadLayers(formData, payload, viewport) {
    this.setState({ subSlices: {}, payloads: {}, viewport, layersLoaded: false });
    let layersToLoad = payload.data.slices.length;
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
          this.setState({
            subSlices: {
              ...this.state.subSlices,
              [subsliceCopy.slice_id]: subsliceCopy,
            },
            payloads: {
              ...this.state.payloads,
              [subsliceCopy.slice_id]: json,
            },
          });
          // this.updateSliderData();
          layersToLoad--;
          if (!layersToLoad) {
            this.prepareData();
            this.setState({
              layersLoaded: true,
            });
          }
        });
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

  renderLegends() {
    const { categories, subSlices } = this.state;
    if (_.difference(Object.keys(categories), Object.keys(subSlices)).length) {
      return null;
    }

    return (
      <div className="legends">
        { Object.keys(categories).map((key, index) =>
        (<Legend
          key={index}
          title={`${subSlices[key].slice_name} (${this.getLabel(subSlices[key])})`}
          inline
          categories={categories[key]}
          toggleCategory={this.toggleCategory}
          showSingleCategory={this.showSingleCategory}
          format={subSlices[key].form_data.legend_format}
        />),
        )
        }
      </div>
    );
  }
  render() {
    const {
      formData,
      payload,
      viewport: propsViewport,
      setControlValue,
    } = this.props;

    const {
      layersLoaded,
      viewport: stateViewport,
      start,
      end,
      getStep,
      values,
      disabled,
    } = this.state;

    return (
      <div>
        {layersLoaded && <div style={{ position: 'relative' }}>
          <AnimatableDeckGLContainer
            getLayers={this.getLayers}
            start={start}
            end={end}
            getStep={getStep}
            values={values}
            onValuesChange={this.onValuesChange}
            disabled={disabled}
            viewport={stateViewport || propsViewport}
            onViewportChange={this.onViewportChange}
            mapboxApiAccessToken={payload.data.mapboxApiKey}
            mapStyle={formData.mapbox_style}
            setControlValue={setControlValue}
            aggregation
          />
          {this.renderLegends(formData)}
        </div>}
      </div>
    );
  }
}

DeckMulti.propTypes = propTypes;
DeckMulti.defaultProps = defaultProps;

export default DeckMulti;
