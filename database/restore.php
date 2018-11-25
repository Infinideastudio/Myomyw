<?php
	require_once("config.php");
	require_once("tool.php");
	$email=$_REQUEST['email'];
	if(!chkemail($email)){
		echo json_encode(array("error_code"=>98));
		return;
	}
	$db=mysqli_connect('localhost',$db_user,$db_passwd);
	if(!$db){
		echo json_encode(array("error_code"=>99));
		return;
	}
	mysqli_select_db( $db,$db_name);
	$sql='select * from user where email='."'$email'";
	$ret=mysqli_query($db,$sql);
	if($ret->num_rows == 0){
		echo json_encode(array("error_code"=>1));
		return;
	}
	$row = mysqli_fetch_array($ret);
	echo json_encode(array("error_code"=>0,"uuid"=>$row['uuid']));
	return;
?>
