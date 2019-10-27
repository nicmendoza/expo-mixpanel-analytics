import {Platform, Dimensions} from 'react-native';
import Constants from 'expo-constants';
import {Buffer} from 'buffer';

const {width, height} = Dimensions.get('window');

const MIXPANEL_API_URL = 'http://api.mixpanel.com';
const isIosPlatform = Platform.OS === 'ios';

export default class ExpoMixpanelAnalytics {
  constructor(token) {
    this.ready = false;
    this.queue = [];

    this.token = token;
    this.userId = null;
    this.clientId = Constants.deviceId;
    this.identify(this.clientId);

    Constants.getWebViewUserAgentAsync()
      .then(userAgent => {
        this.userAgent = userAgent;
        this.appName = Constants.manifest.name;
        this.appId = Constants.manifest.slug;
        this.appVersion = Constants.manifest.version;
        this.screenSize = `${width}x${height}`;
        this.deviceName = Constants.deviceName;
        if (isIosPlatform) {
          this.platform = Constants.platform.ios.platform;
          this.model = Constants.platform.ios.model;
          this.osVersion = Constants.platform.ios.systemVersion;
        } else {
          this.platform = "android";
        }

        this.ready = true;
        this._flush();
      });
  }

  track(name, props) {
    this.queue.push({
      name,
      props
    });
    this._flush();
  }

  identify(userId) {
    this.userId = userId;
  }

  reset() {
    this.identify(this.clientId);
  }

  people_set(props) {
    this._people('set', props);
  }

  people_set_once(props) {
    this._people('set_once', props);
  }

  people_unset(props) {
    this._people('unset', props);
  }

  people_increment(props) {
    this._people('add', props);
  }

  people_append(props) {
    this._people('append', props);
  }

  people_union(props) {
    this._people('union', props);
  }

  people_delete_user() {
    this._people('delete', '');
  }

  // ===========================================================================================

  _flush() {
    if (this.ready) {
      while (this.queue.length) {
        const event = this.queue.pop();
        this._pushEvent(event)
          .then(() => event.sent = true);
      }
    }
  }

  _people(operation, props) {
    if (this.userId) {
      const data = {
        "$token": this.token,
        "$distinct_id": this.userId
      };
      data[`$${operation}`] = props;

      this._pushProfile(data);
    }
  }

  _pushEvent(event) {
    let data = {
      event: event.name,
      properties: event.props
    };
    if (this.userId) {
      data.properties.distinct_id = this.userId;
    }
    data.properties.token = this.token;
    data.properties['User Agent']= this.userAgent;
    data.properties['App Name'] = this.appName;
    data.properties['App ID'] = this.appId;
    data.properties['App Version'] = this.appVersion;
    data.properties['Screen Size'] = this.screenSize;
    data.properties['Client ID'] = this.clientId;
    data.properties['Device Name'] = this.deviceName;
    if (this.platform) {
      data.properties['Platform'] = this.platform;
    }
    if (this.model) {
      data.properties['Model'] = this.model;
    }
    if (this.osVersion) {
      data.properties['OS Version'] = this.osVersion;
    }

    data = new Buffer(JSON.stringify(data)).toString('base64');

    return fetch(`${MIXPANEL_API_URL}/track/?data=${data}`);
  }

  _pushProfile(data) {
    data = new Buffer(JSON.stringify(data)).toString('base64');
    return fetch(`${MIXPANEL_API_URL}/engage/?data=${data}`);
  }
}
