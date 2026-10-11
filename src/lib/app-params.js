import { getAccessToken, setAccessToken } from '@/api/client';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get('clear_access_token') === 'true';

const clearStoredAccessToken = () => {
	setAccessToken(null);
};

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		token: getAccessToken(),
	};
};

export const appParams = {
	...getAppParams(),
};
