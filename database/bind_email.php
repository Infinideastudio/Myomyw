<?php
	require_once("config.php");
	require_once("tool.php");
	$uuid=$_REQUEST['uuid'];
	$email=$_REQUEST['email'];
	if(!chkuuid($uuid) || !chkemail($email)){
		echo json_encode(array("error_code"=>98));
		return;
	}
	$db=mysqli_connect('localhost',$db_user,$db_passwd);
	if(!$db){
		echo json_encode(array("error_code"=>99));
		return;
	}
	mysqli_select_db( $db,$db_name);
	$sql='update user set email='."'$email'".' where uuid='."'$uuid'";
	$ret=mysqli_query($db,$sql);
	if(!$ret){
		echo json_encode(array("error_code"=>97));
		return;
	}
	echo json_encode(array("error_code"=>0));
	return;
?>
