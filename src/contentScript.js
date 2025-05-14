import { ui, forceNavigator } from "./shared"

forceNavigator.getIdFromUrl = ()=>{
	const url = document.location.href
	const ID_RE = [
		/http[s]?\:\/\/.*force\.com\/.*([a-zA-Z0-9]{18})[^\w]*/, // tries to find the first 18 digit
		/http[s]?\:\/\/.*force\.com\/.*([a-zA-Z0-9]{15})[^\w]*/ // falls back to 15 digit
	]
	for(let i in ID_RE) {
		const match = url.match(ID_RE[i])
		if (match != null) { return match[1] }
	}
	return false
}
forceNavigator.init()
