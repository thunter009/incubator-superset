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
import { t } from '@superset-ui/translation';
// import { nonEmpty } from '../validators';
import timeGrainSqlaAnimationOverrides from './timeGrainSqlaAnimationOverrides';

export default {
  requiresTime: false,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['spatial', 'text'],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['autozoom', null],
      ],
    },
    {
      label: t('Text'),
      controlSetRows: [
        ['color_picker', 'clusterize'],
        ['grade_colors', 'color_scheme'],
        ['enable_gradient', 'color_picker_alt'],
        ['per_zoom_level', null],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        ['js_columns'],
        ['js_data_mutator'],
        ['js_tooltip'],
        ['js_onclick_href'],
      ],
    },
  ],
  controlOverrides: {
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};