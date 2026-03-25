property savedFrontApp : ""
property cliclickPath : ""

on run argv
	-- Find cliclick: bundled first, then homebrew fallback
	set scriptDir to do shell script "dirname " & quoted form of POSIX path of ((path to me) as text)
	set bundledCliclick to scriptDir & "/../bin/cliclick"
	if (do shell script "test -f " & quoted form of bundledCliclick & " && echo yes || echo no") is "yes" then
		set cliclickPath to bundledCliclick
	else if (do shell script "test -f /opt/homebrew/bin/cliclick && echo yes || echo no") is "yes" then
		set cliclickPath to "/opt/homebrew/bin/cliclick"
	else
		set cliclickPath to "cliclick"
	end if
	set thePrompt to item 1 of argv
	set theAudioPath to item 2 of argv
	set jsResult to "OK"

	-- Parse title/weirdness pairs from remaining args
	set genCount to ((count of argv) - 2) / 2
	set titles to {}
	set weirdnesses to {}
	repeat with i from 1 to genCount
		set end of titles to item (i * 2 + 1) of argv
		set end of weirdnesses to item (i * 2 + 2) of argv
	end repeat

	try
		tell application "System Events"
			set savedFrontApp to name of first application process whose frontmost is true
		end tell
	on error
		set savedFrontApp to ""
	end try

	try
		tell application "Google Chrome"
			activate
			delay 0.3

			if (count of windows) is 0 then
				make new window
				delay 1
			end if

			try
				set bounds of front window to {900, 400, 1800, 1000}
			end try

			-- Find existing Suno tab or create one
			set sunoTab to missing value
			set sunoWindow to front window
			repeat with w in windows
				repeat with t in tabs of w
					if URL of t contains "suno.com" then
						set sunoTab to t
						set sunoWindow to w
						exit repeat
					end if
				end repeat
				if sunoTab is not missing value then exit repeat
			end repeat

			if sunoTab is missing value then
				-- Reuse blank/new tab if it exists, otherwise create one
				set frontTab to active tab of front window
				set frontURL to URL of frontTab
				if frontURL is "chrome://newtab/" or frontURL is "" or frontURL is "about:blank" then
					set URL of frontTab to "https://suno.com/create"
					set sunoTab to frontTab
				else
					tell front window
						set sunoTab to make new tab with properties {URL:"https://suno.com/create"}
					end tell
				end if
				delay 4
			else
				if URL of sunoTab does not contain "/create" then
					set URL of sunoTab to "https://suno.com/create"
					delay 3
				end if
			end if

			-- Check login
			set loginCheck to execute sunoTab javascript "document.cookie.indexOf('__session') !== -1 ? 'LOGGED_IN' : 'NOT_LOGGED_IN'"

			if loginCheck is "NOT_LOGGED_IN" then
				try
					set bounds of sunoWindow to {400, 200, 1200, 800}
				end try
				repeat 36 times
					delay 5
					set loginCheck to execute sunoTab javascript "document.cookie.indexOf('__session') !== -1 ? 'LOGGED_IN' : 'NOT_LOGGED_IN'"
					if loginCheck is "LOGGED_IN" then exit repeat
				end repeat

				if loginCheck is "NOT_LOGGED_IN" then
					return "LOGIN_TIMEOUT"
				end if

				try
					set bounds of sunoWindow to {900, 400, 1800, 1000}
				end try
				delay 2

				set currentURL to execute sunoTab javascript "window.location.href"
				if currentURL does not contain "/create" then
					set URL of sunoTab to "https://suno.com/create"
					delay 3
				end if
			end if

			-- If audio file provided, upload it first (only once)
			if theAudioPath is not "" then
				my uploadAudio(sunoTab, theAudioPath)
			end if

			-- Generate each song
			repeat with i from 1 to genCount
				set songTitle to item i of titles
				set songWeirdness to item i of weirdnesses

				my fillAndCreate(sunoTab, songTitle, thePrompt, songWeirdness)
				delay 3

				if i < genCount then
					execute sunoTab javascript "window.scrollTo(0,0)"
					delay 2
				end if
			end repeat

			-- Minimize
			delay 1
			try
				set miniaturized of sunoWindow to true
			end try
		end tell
	end try

	my refocus()

	return jsResult
end run

on refocus()
	if savedFrontApp is not "" then
		try
			tell application savedFrontApp to activate
		end try
	end if
end refocus

on uploadAudio(sunoTab, audioPath)
	tell application "Google Chrome"
		activate
		delay 1
		execute sunoTab javascript "window.scrollTo(0,0)"
		delay 1

		-- Get +Audio button screen coords
		set btnX to execute sunoTab javascript "(function(){ var btn = document.querySelector('button[aria-label*=\"Add audio\"]'); if(!btn) return '0'; var r = btn.getBoundingClientRect(); return String(Math.round(window.screenX + r.left + r.width/2)); })()"
		set btnY to execute sunoTab javascript "(function(){ var btn = document.querySelector('button[aria-label*=\"Add audio\"]'); if(!btn) return '0'; var r = btn.getBoundingClientRect(); return String(Math.round(window.screenY + (window.outerHeight - window.innerHeight) + r.top + r.height/2)); })()"

		if btnX is "0" then
			return
		end if

		-- Physical click to open dropdown
		do shell script cliclickPath & " c:" & btnX & "," & btnY
		delay 2

		-- Click Upload (2nd dropdown item, ~80px below button)
		set uploadY to (btnY as integer) + 80
		do shell script cliclickPath & " c:" & btnX & "," & uploadY
		delay 3

		-- File dialog is open — navigate to file
		tell application "System Events"
			keystroke "g" using {command down, shift down}
			delay 1.5
			keystroke audioPath
			delay 0.5
			key code 36
			delay 2
			key code 36
			delay 5
		end tell

		-- Wait for upload to process
		delay 5

		-- Click Save
		execute sunoTab javascript "(function(){ var all = document.querySelectorAll('button'); for(var i=0;i<all.length;i++){if(all[i].textContent.trim()==='Save'){all[i].click(); return 'OK';}} return 'NO'; })()"
		delay 4

		-- Click Cover (text starts with "Cover")
		execute sunoTab javascript "(function(){ var all = document.querySelectorAll('button'); for(var i=0;i<all.length;i++){if(all[i].textContent.trim().indexOf('Cover')===0){all[i].click(); return 'OK';}} return 'NO'; })()"
		delay 4

		-- Click Continue
		execute sunoTab javascript "(function(){ var all = document.querySelectorAll('button'); for(var i=0;i<all.length;i++){if(all[i].textContent.trim().indexOf('Continue')!==-1){all[i].click(); return 'OK';}} return 'NO'; })()"
		delay 4

		-- Handle Overwrite Styles dialog if it appears
		execute sunoTab javascript "(function(){ var all = document.querySelectorAll('button'); for(var i=0;i<all.length;i++){if(all[i].textContent.trim()==='Overwrite'){all[i].click(); return 'OK';}} return 'NO'; })()"
		delay 3
	end tell
	my refocus()
end uploadAudio

on fillAndCreate(sunoTab, songTitle, prompt, weirdness)
	tell application "Google Chrome"
		-- Open More options to reveal Weirdness slider
		execute sunoTab javascript "
(function() {
  var btns = document.querySelectorAll('button');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].textContent.trim() === 'More') {
      btns[i].click();
      break;
    }
  }
})();
"
		delay 1

		-- Set weirdness by double-clicking the % display and typing the value
		execute sunoTab javascript "
(function() {
  var slider = document.querySelector('[role=slider][aria-label=Weirdness]');
  if (!slider) return 'NO_SLIDER';
  var container = slider.parentElement.parentElement;
  var divs = container.querySelectorAll('div');
  for (var i = 0; i < divs.length; i++) {
    if (divs[i].children.length === 0 && divs[i].textContent.trim().match(/^\\d+%$/)) {
      divs[i].dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
      return 'DBLCLICKED';
    }
  }
  return 'NO_PERCENT_DISPLAY';
})();
"
		delay 0.5

		-- Now find the input that appeared and set the value
		execute sunoTab javascript "
(function() {
  var slider = document.querySelector('[role=slider][aria-label=Weirdness]');
  if (!slider) return 'NO_SLIDER';
  var container = slider.parentElement.parentElement;
  var inputs = container.querySelectorAll('input');
  var numInput = null;
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].value.match(/^\\d+$/)) { numInput = inputs[i]; break; }
  }
  if (!numInput) return 'NO_INPUT';

  var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  numInput.focus();
  numInput.select();
  nativeSetter.call(numInput, '" & weirdness & "');
  numInput.dispatchEvent(new Event('input', {bubbles: true}));
  numInput.dispatchEvent(new Event('change', {bubbles: true}));
  numInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true}));
  numInput.blur();
  return 'SET_TO_" & weirdness & "';
})();
"
		delay 0.5

		-- Fill in title and styles, then click Create
		execute sunoTab javascript "
(function() {
  var nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  var nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

  var inputs = document.querySelectorAll('input');
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].placeholder.indexOf('Song Title') !== -1) {
      inputs[i].focus();
      nativeInputSetter.call(inputs[i], " & my escapeForJS(songTitle) & ");
      inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
  }

  var textareas = document.querySelectorAll('textarea');
  var stylesTA = textareas[1];
  if (!stylesTA) return 'STYLES_TEXTAREA_NOT_FOUND';

  stylesTA.focus();
  stylesTA.select();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, " & my escapeForJS(prompt) & ");

  var buttons = document.querySelectorAll('button');
  for (var j = 0; j < buttons.length; j++) {
    if (buttons[j].getAttribute('aria-label') === 'Create song') {
      setTimeout(function() { buttons[j].click(); }, 500);
      return 'OK';
    }
  }
  return 'BUTTON_NOT_FOUND';
})();
"
		delay 2
	end tell
	my refocus()
end fillAndCreate

on escapeForJS(theText)
	set output to "'"
	repeat with i from 1 to length of theText
		set c to character i of theText
		if c is "'" then
			set output to output & "\\'"
		else if c is "\\" then
			set output to output & "\\\\"
		else if c is return or c is (ASCII character 10) then
			set output to output & " "
		else
			set output to output & c
		end if
	end repeat
	set output to output & "'"
	return output
end escapeForJS
