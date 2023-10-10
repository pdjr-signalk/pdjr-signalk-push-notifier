import React, { createRef } from 'react'
import { Card, CardHeader, CardBody } from 'reactstrap'
import PluginConfigurator from './PluginConfigurator';

/**
 * props.configuration = the plugin configuration from Signal K.
 * props.save = Signal K callback function which saves configuration.
 */
export default (props) => {

  return (
    <Card>
      <CardHeader>Alarm Manager Configuration</CardHeader>
      <CardBody>
        <div>
          <div style={{ width: '100%' }}>
            <PluginConfigurator configuration = {props.configuration} save = {(config) => props.save(config)} />
          </div>
        </div>
      </CardBody>
    </Card>
  );

}

