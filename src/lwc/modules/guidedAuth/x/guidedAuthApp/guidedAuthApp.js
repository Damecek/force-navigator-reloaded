import { LightningElement, track } from 'lwc';
import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_FAILED_AUTH_FLOW,
  CHANNEL_INVOKE_AUTH_FLOW,
  CHANNEL_REFRESH_COMMANDS,
} from '../../../../../shared';

/**
 * Root component for Guided Auth page.
 */
export default class GuidedAuthApp extends LightningElement {
  static renderMode = 'light';

  @track isWorking = false;
  @track statusMessage = '';
  @track statusVariant = '';

  hostname = '';
  sourceTabId;
  oauthError = '';
  oauthErrorDescription = '';
  installUrl = '';
  connectedAppsUsageUrl = '';
  remediation = 'install';

  connectedCallback() {
    const params = new URLSearchParams(window.location.search);
    this.hostname = params.get('host') || '';
    this.oauthError = params.get('error') || '';
    this.oauthErrorDescription = params.get('errorDescription') || '';
    this.installUrl = params.get('installUrl') || '';
    this.connectedAppsUsageUrl = params.get('connectedAppsUsageUrl') || '';
    this.remediation = params.get('remediation') || 'install';
    const sourceTabId = Number(params.get('sourceTabId'));
    this.sourceTabId = Number.isFinite(sourceTabId) ? sourceTabId : undefined;
    new Channel(CHANNEL_COMPLETED_AUTH_FLOW).subscribe(this.handleAuthSuccess);
    new Channel(CHANNEL_FAILED_AUTH_FLOW).subscribe(this.handleAuthFailure);
    if (!this.hostname) {
      this.setError(
        'Missing Salesforce host. Open Guided Auth from a Salesforce tab using Extension > Authorize.'
      );
      return;
    }
    void this.resolveSourceTabId();
  }

  get hostLabel() {
    return this.hostname || 'No Salesforce host provided';
  }

  get hasSourceTabId() {
    return typeof this.sourceTabId === 'number';
  }

  get hasInstallUrl() {
    return Boolean(this.installUrl);
  }

  get hasConnectedAppsUsageUrl() {
    return Boolean(this.connectedAppsUsageUrl);
  }

  get isBlockedRemediation() {
    return this.remediation === 'blocked';
  }

  get errorSummary() {
    if (this.oauthError === 'OAUTH_APP_BLOCKED') {
      return 'OAUTH_APP_BLOCKED: this app is blocked by admin.';
    }
    if (this.oauthError === 'authorization_canceled') {
      return 'OAuth popup was closed before completion.';
    }
    if (!this.oauthError) {
      return 'Authorization failed because this connected app is not currently allowed for your org.';
    }
    if (this.oauthErrorDescription) {
      return `${this.oauthError}: ${this.oauthErrorDescription}`;
    }
    return this.oauthError;
  }

  get introMessage() {
    if (this.isBlockedRemediation) {
      return 'Salesforce blocked authorization for this app. Your admin must allow access in Connected Apps OAuth Usage.';
    }
    return 'Salesforce blocked this authorization because the connected app is not currently allowed for your org.';
  }

  get statusClassName() {
    if (this.statusVariant === 'error') {
      return 'guided-auth-status guided-auth-status_error';
    }
    if (this.statusVariant === 'success') {
      return 'guided-auth-status guided-auth-status_success';
    }
    return 'guided-auth-status';
  }

  async handleInvokeAuthClick() {
    if (!this.hostname) {
      this.setError('Cannot invoke auth without a Salesforce host.');
      return;
    }
    this.isWorking = true;
    this.setInfo('Launching Salesforce authorization...');
    await new Channel(CHANNEL_INVOKE_AUTH_FLOW).publish({
      data: { hostname: this.hostname },
    });
  }

  async handleAuthorizeAfterInstallClick() {
    if (!this.hostname) {
      this.setError('Cannot invoke authorization without a Salesforce host.');
      return;
    }
    this.isWorking = true;
    this.setInfo('Invoking authorization...');
    await new Channel(CHANNEL_INVOKE_AUTH_FLOW).publish({
      data: { hostname: this.hostname },
    });
  }

  handleAuthSuccess = async () => {
    if (this.hasSourceTabId) {
      await new Channel(CHANNEL_REFRESH_COMMANDS).publish({
        data: {
          hostname: this.hostname,
          targetTabId: this.sourceTabId,
        },
      });
      this.setSuccess(
        'Authorization succeeded. Command list refresh was sent to your original Salesforce tab.'
      );
    } else {
      this.setSuccess(
        'Authorization succeeded. Return to your Salesforce tab and run Extension > Refresh Command List.'
      );
    }
    this.isWorking = false;
  };

  handleAuthFailure = ({ data }) => {
    this.isWorking = false;
    this.setError(data?.message || 'Authorization failed.');
  };

  setInfo(message) {
    this.statusMessage = message;
    this.statusVariant = '';
  }

  setError(message) {
    this.statusMessage = message;
    this.statusVariant = 'error';
  }

  setSuccess(message) {
    this.statusMessage = message;
    this.statusVariant = 'success';
  }

  /**
   * Recover source tab id from host when query param is missing.
   * @returns {Promise<void>}
   */
  async resolveSourceTabId() {
    if (this.hasSourceTabId || !this.hostname) {
      return;
    }
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ url: `https://${this.hostname}/*` }, resolve);
    });
    const sourceTab = tabs.find((tab) => typeof tab?.id === 'number');
    if (sourceTab?.id) {
      this.sourceTabId = sourceTab.id;
    }
  }
}
