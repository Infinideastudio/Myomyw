<?php
function chkname($name){
	if (!preg_match("/^([\w]*)$/",$name)) {
		return false;
	}
	return true;
}	
function chkemail($email){
	if (!preg_match("/^([\w\-]+\@[\w\-]+\.[\w\-]+)$/",$email)) {
		return false;
	}
	return true;
}
function chkuuid($uuid){
	if (!preg_match("/^([\w\-]+)$/",$uuid)) {
		return false;
	}
	return true;
}
?>
