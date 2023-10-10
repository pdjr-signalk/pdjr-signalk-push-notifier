import React from 'react';
import { Button } from 'reactstrap';
import FormField from './FormField';

/**
 * Render a panel for editing Output channel configuration data.
 * 
 * panelStyle - CSS for the panel.
 * labelWidth - the width mod 12 reserved for the input field label.
 * notificationStates - array of notification states used in Select.
 * output - the output channel configuration object.
 * onChangeCallback - method to be called when a field change occurs.
 * onDeleteCallback - method to be called to delete this channel.
 * 
 * @param {} param0 
 * @returns - Component for rendering the panel.
 */
export default function Output({
  panelStyle={},
  labelWidth='3',
  notificationStates=[],
  output,
  onChangeCallback,
  onDeleteCallback
}){
  //console.log("Output: %s", JSON.stringify(output));
  return(
    <div style={panelStyle}>
      <FormField
        type='text' label='Name' labelWidth={labelWidth} value={output.name}
        onChangeCallback={(v) => onChangeCallback(output.name, 'name', v)}
      />
      <FormField
        type='text' label='Path' labelWidth={labelWidth} value={output.path}
        onChangeCallback={(v) => onChangeCallback(output.name, 'path', v)}
      />
      <FormField
        type='multiselect' label='Triggers' labelWidth={labelWidth} value={output.triggerStates.map(s => ({ label: s, value: s}))} 
        options={notificationStates.map(s => ({ label: s, value: s }))}
        onChangeCallback={(v) => onChangeCallback(output.name, 'triggerStates', (v || []).map(s => s.value))}
      />
      <FormField
        type='text' label='Suppression path' labelWidth={labelWidth} value={output.suppressionPath}
        onChangeCallback={(v) => onChangeCallback(output.name, 'suppressionPath', v)}
      />
      <div>
        <Button onClick={()=>onDeleteCallback(output.name)}>Delete</Button>
      </div>
    </div>
  );
}