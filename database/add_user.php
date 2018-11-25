<?php
	require_once('config.php');
	require_once('tool.php');
	$db=mysqli_connect('localhost',$db_user,$db_passwd);
	$uuid=$_REQUEST['uuid'];
	$username=$_REQUEST['username'];
	if(!$db){
		echo json_encode(array("error_code"=>99));
		return;
	}
	if(!chkname($username) || !chkuuid($uuid)){
		echo json_encode(array("error_code"=>98));
		return;
	}
	mysqli_select_db( $db,$db_name);
	$sql='select username from user where username='."'$username'";
	$ret=mysqli_query($db,$sql);
	if($ret->num_rows > 0){
		echo json_encode(array("error_code"=>31));
		return;
	}
	$sql = "insert into user".
        "(username,uuid,email,rating)".
        "values".
        "('$username','$uuid',NULL,1500)";
	$ret=mysqli_query($db,$sql);
	if(!$ret){
		echo json_encode(array("error_code"=>99));
		return;
	}
	echo json_encode(array("error_code"=>0));
		return;
?>
