/**********************************************************************
 * Copyright 2020 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

var nodemailer = require("nodemailer");

module.exports = class Email {

  constructor(transportOptions, messageOptions, debug) {
    if (debug) debug("Email.constructor(%s,%s)...", JSON.stringify(transportOptions), JSON.stringify(messageOptions));
    this.transportOptions = transportOptions;
    this.messageOptions = messageOptions;
    this.transporter = nodemailer.createTransport(this.transportOptions, this.messageOptions);
    this.debug = debug;
  }

  send(options) {
    if (this.debug) this.debug("Email.send(%s)...", JSON.stringify(options));
    if (!Array.isArray(options.recipients)) options.recipients = [options.recipients];
    if (!Array.isArray(options.ccrecipients)) options.ccrecipients = [options.ccrecipients];

    this.transporter.sendMail(options, (error, info) => {
      if (error) throw new Error(error);
    });
  }

}
