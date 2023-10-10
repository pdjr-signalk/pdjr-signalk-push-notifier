import React from 'react';
import { Button, Col, FormGroup } from 'reactstrap';
import Collapsible from 'react-collapsible';
import Output from './Output';

export default function Outputs({
  labelWidth='3',
  collapsibleTriggerStyle={},
  collapsiblePanelStyle={},
  collapsibleLabel='Outputs',
  panelStyle={},
  notificationStates=[],
  outputs,
  onChangeCallback,
  onDeleteCallback,
  onCreateCallback
}){
  //console.log("Outputs: %s", JSON.stringify(outputs));
  return(
    <FormGroup row>
      <Col>
        <Collapsible trigger={collapsibleLabel + "..."} triggerStyle={collapsibleTriggerStyle}>
          <div style={collapsiblePanelStyle}>
            {
              outputs.map(output => {
                return(
                  <Output
                    panelStyle={panelStyle}
                    labelWidth={labelWidth}
                    output={output}
                    notificationStates={notificationStates}
                    onChangeCallback={onChangeCallback}
                    onDeleteCallback={onDeleteCallback}
                  />
                );
              })
            }
            <div>
              <Button onClick={() => onCreateCallback()} style={{ width: '100%' }}>+</Button>
            </div>
          </div>
        </Collapsible>
      </Col>
    </FormGroup>
  );
}