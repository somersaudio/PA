tell application "Google Chrome"
	-- Find existing Suno tab or use active tab
	set sunoTab to missing value
	repeat with w in windows
		repeat with t in tabs of w
			if URL of t contains "suno.com" then
				set sunoTab to t
				exit repeat
			end if
		end repeat
		if sunoTab is not missing value then exit repeat
	end repeat

	if sunoTab is missing value then
		-- Navigate active tab to Suno
		activate
		tell front window
			set sunoTab to make new tab with properties {URL:"https://suno.com/create"}
		end tell
		delay 3
	end if

	return execute sunoTab javascript "document.cookie"
end tell
