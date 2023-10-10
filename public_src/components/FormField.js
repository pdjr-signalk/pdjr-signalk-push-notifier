import React from 'react';
import { Col, FormGroup, FormText, Label, Input } from 'reactstrap';
import Select from 'react-select';

export default function FormField({
  type,
  name,
  value,
  label,
  radios,
  text,
  labelWidth,
  wrap,
  options,
  rows,
  labelStyle,
  style,
  onChangeCallback
}){
  return(
    <FormGroup row>
      {
        (label)
        ? <Col md={labelWidth}><Label style={labelStyle} htmlFor={name}>{label}</Label></Col>
        : ''
      }
      <Col>
        {
          (type == 'checkbox')
          ? <Input type='checkbox' name={name} onChange={(e)=>onChangeCallback(e.target.value)} checked={value} />
          : ''
        }
        {
          (type == 'multiselect')
          ? <Select name={name} options={options} value={value} isMulti className="basic-multi-select" classNamePrefix="select" onChange={(v) => onChangeCallback(v)} />
          : ''
        }
        {
          (type == 'text')
          ? <Input type='text' name={name} value={value} onChange={(e) => onChangeCallback(e.target.value)} />
          : ''
        }
        {
          (type == 'textarea')
          ? <textarea name={name} value={value} rows={rows} wrap={wrap} style={style} onChange={(e) => onChangeCallback(e.target.value)} />
          : ''
        }
        {
          (text)
          ? <FormText color='muted'>{text}</FormText>
          : ''
        }
      </Col>
    </FormGroup>
  )
}