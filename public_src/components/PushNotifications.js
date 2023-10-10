import React from 'react';
import { Col, FormGroup } from 'reactstrap';
import Collapsible from 'react-collapsible';
import FormField from './FormField';

export default function PushNotifications({
  labelWidth='3',
  collapsibleTriggerStyle={},
  collapsiblePanelStyle={},
  collapsibleLabel='Push notifications',
  notificationStates=[],
  pushNotifications,
  onChangeCallback
}) {
  //console.log("DefaultMethods: %s", JSON.stringify(methods));
  return(
    <FormGroup row>
      <Col>
        <Collapsible trigger={collapsibleLabel + "..."} collapsibleTriggerStyle={collapsibleTriggerStyle}>
          <div style={collapsiblePanelStyle}>
            <FormField
              type='checkbox'
              name='enabled'
              label='Send push notifications'
              labelWidth={labelWidth}
              value={pushNotifications.enabled}
              onChangeCallback={(v) => onChangeCallback('enabled', v)}
            />
            <FormField
              type='multiselect'
              name='triggerStates'
              label='Trigger states'
              labelWidth={labelWidth}
              value={pushNotifications.triggerStates.map(v => ({ label: v, value: v }))}
              options={notificationStates.map(v => ({ label: v, value: v }))}
              onChangeCallback={(options) => onChangeCallback('triggerStates', (options || []).map(v => v.value))}
            />
            <FormField
              type='text'
              name='resourcesProviderId'
              label='Resources provider id'
              labelWidth={labelWidth}
              value={pushNotifications.resourcesProviderId}
              onChangeCallback={(v) => onChangeCallback('resourcesProviderId', v)}
            />
            <FormField
              type='text'
              name='resourceType'
              label='Resources type'
              labelWidth={labelWidth}
              value={pushNotifications.resourceType}
              onChangeCallback={(v) => onChangeCallback('resourceType', v)}
            />
          </div>
        </Collapsible>
      </Col>
    </FormGroup>
  )
}